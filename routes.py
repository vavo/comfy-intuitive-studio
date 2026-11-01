"""Same-origin local Comfy routes; never return credentials or raw provider errors."""
import asyncio
import json
import uuid
import tempfile
import mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from aiohttp import web
from .policy import catalog, validate
from .vendor.client import FormaError, key_status
from .budget import BudgetClient

ROOT = Path(__file__).parent


def guard(request):
    origin = request.headers.get("Origin")
    if origin and urlsplit(origin).netloc != request.host:
        raise web.HTTPForbidden(text="Cross-origin request rejected.")
    if request.headers.get("X-Intuitive-Studio") != "1":
        raise web.HTTPForbidden(text="Studio request header required.")


def install(routes):
    @routes.get("/intuitive-studio/catalog")
    async def get_catalog(request):
        return web.json_response({**catalog(), "keyConfigured": key_status()["configured"]})

    @routes.get("/intuitive-studio/workflow/{mode}")
    async def workflow(request):
        from .policy import ALL_WORKFLOWS
        mode = request.match_info["mode"]
        if mode not in ALL_WORKFLOWS:
            raise web.HTTPNotFound()
        return web.json_response(json.loads((ROOT / "workflows" / (mode + ".app.json")).read_text()))

    @routes.post("/intuitive-studio/quote")
    async def quote(request):
        guard(request)
        try:
            raw = await request.text()
            state, options, _ = validate(raw)
            result = await asyncio.to_thread(BudgetClient().request, "/quotes", {**options, "requestId": str(uuid.uuid4())})
            return web.json_response({"cents": result["quote"]["cents"], "expires": result["quote"]["expires"]}, headers={"Cache-Control": "no-store"})
        except (FormaError, ValueError, TypeError) as error:
            return web.json_response({"error": str(error) if isinstance(error, FormaError) else "Invalid request."}, status=400)

    @routes.post("/intuitive-studio/preview")
    async def preview(request):
        guard(request)
        try:
            body = await request.json()
            asset_id = str(uuid.UUID(body["reference"].removeprefix("asset:")))
            kind = body["kind"]
            if kind not in {"image", "video", "audio"}:
                raise ValueError()
            with tempfile.TemporaryDirectory(prefix="studio-preview-") as directory:
                path = await asyncio.to_thread(BudgetClient().download, asset_id, directory, kind)
                return web.Response(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0],
                                    headers={"Cache-Control": "no-store"})
        except (FormaError, ValueError, KeyError, TypeError, AttributeError):
            return web.json_response({"error": "Preview unavailable. The reference is still saved."}, status=400)

    @routes.post("/intuitive-studio/upload")
    async def upload(request):
        guard(request)
        allowed = {"image/png", "image/jpeg", "image/webp", "audio/wav", "audio/mpeg", "video/mp4", "video/webm"}
        mime = request.content_type
        if mime not in allowed:
            return web.json_response({"error": "Unsupported media type."}, status=400)
        data = bytearray()
        async for chunk in request.content.iter_chunked(65536):
            data.extend(chunk)
            if len(data) > 32 * 1024 * 1024:
                return web.json_response({"error": "Prototype upload limit is 32 MB."}, status=413)
        try:
            reference = await asyncio.to_thread(BudgetClient().upload, bytes(data), mime, 1)
            return web.json_response({"reference": reference}, headers={"Cache-Control": "no-store"})
        except FormaError as error:
            return web.json_response({"error": str(error)}, status=400)
