import importlib
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

root = Path(__file__).resolve().parents[1]
package = types.ModuleType('studio')
package.__path__ = [str(root)]
sys.modules['studio'] = package
client = importlib.import_module('studio.vendor.client')
routes = importlib.import_module('studio.routes')


class ConnectionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / '.forma' / 'api.key'
        self.path_patch = patch.object(client, 'saved_key_path', return_value=self.path)
        self.path_patch.start()
        self.env_patch = patch.dict(os.environ, {'FORMA_API_KEY':'forma_' + 'a'*64, 'FORMA_API_KEY_FILE':''})
        self.env_patch.start()
        table = web.RouteTableDef()
        routes.install(table)
        app = web.Application()
        app.add_routes(table)
        self.http = TestClient(TestServer(app))
        await self.http.start_server()

    async def asyncTearDown(self):
        await self.http.close()
        self.path_patch.stop()
        self.env_patch.stop()
        self.directory.cleanup()

    async def post(self, body, headers=None):
        return await self.http.post('/intuitive-studio/connection', json=body,
                                    headers=headers or {'X-Intuitive-Studio':'1'})

    async def test_validated_save_override_and_private_storage(self):
        key = 'forma_' + 'b'*64
        used = []
        def wallet(instance, path):
            used.append((instance.key, path))
            return {'balance':0}
        with patch.object(client.FormaClient, 'request', wallet):
            response = await self.post({'key':key})
            data = await response.json()
            self.assertEqual(response.status, 200)
            self.assertTrue(data['connected'])
            self.assertEqual(data['source'], 'saved')
            self.assertNotIn(key, json.dumps(data))
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertEqual(client.FormaClient().key, key)
            self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(self.path.parent.stat().st_mode & 0o777, 0o700)
            await self.post({})
        self.assertEqual(used, [(key, '/wallet'), (key, '/wallet')])

    async def test_rejected_replacement_keeps_existing_key(self):
        old = 'forma_' + 'c'*64
        client.save_key(old)
        with patch.object(client.FormaClient, 'request', side_effect=client.FormaError('Invalid key',401)):
            response = await self.post({'key':'forma_'+'d'*64})
        self.assertEqual(response.status, 400)
        self.assertEqual(client.FormaClient().key, old)

    async def test_missing_key_does_not_call_provider(self):
        with patch.dict(os.environ, {'FORMA_API_KEY':'','FORMA_API_KEY_FILE':''}), patch.object(client.FormaClient, 'request') as network:
            response = await self.post({})
            self.assertFalse((await response.json())['connected'])
            network.assert_not_called()

    async def test_malformed_secret_and_cross_origin_rejected(self):
        with patch.object(client.FormaClient, 'request') as network:
            for body in [{'key':''}, {'key':None}, {'key':'x'*600}, {'unexpected':True}]:
                self.assertEqual((await self.post(body)).status, 400)
            self.assertEqual((await self.post({}, {'X-Intuitive-Studio':'1','Origin':'https://evil.example'})).status,403)
            response = await self.http.post('/intuitive-studio/connection',json={})
            self.assertEqual(response.status,403)
            network.assert_not_called()


if __name__ == '__main__':
    unittest.main()
