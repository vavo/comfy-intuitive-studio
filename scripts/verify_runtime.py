"""No-cost acceptance checks against the running local ComfyUI instance."""
import json
import os
import time
import uuid
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = f"http://127.0.0.1:{int(os.environ.get('STUDIO_PORT', '8190'))}"


def request(path, body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    req = Request(BASE + path, data=data, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urlopen(req, timeout=20) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, error.read().decode()


def main():
    status, catalog = request("/intuitive-studio/catalog")
    assert status == 200 and len(catalog["workflows"]) == 10
    assert len(catalog["models"]) == 10
    assert all(not m["id"].startswith("fal-") for m in catalog["models"])
    studio_headers = {"X-Intuitive-Studio": "1"}
    base = {"model": "seedream-v4-t2i", "workflow": "text-to-image", "values": {"prompt": "test"},
            "session": str(uuid.uuid4()), "run": 1, "cap": 0}
    assert request("/intuitive-studio/quote", base, studio_headers)[0] == 400
    assert request("/intuitive-studio/quote", base)[0] == 403
    assert request("/intuitive-studio/quote", base, {**studio_headers, "Origin": "https://example.com"})[0] == 403
    base.update(model="wan-2-2-i2v-720", workflow="image-to-video", values={"prompt": "test", "image": "https://example.com/input.png", "duration": 3})
    assert request("/intuitive-studio/quote", base, studio_headers)[0] == 400
    assert request("/intuitive-studio/workflow/unknown")[0] == 404
    for mode in catalog["workflows"]:
        status, graph = request("/intuitive-studio/workflow/" + mode)
        assert status == 200 and graph["extra"]["linearMode"] is True
        assert len(graph["nodes"]) == 2
    status, info = request("/object_info/SaveVideo")
    assert status == 200 and "video" in info["SaveVideo"]["input"]["required"]
    client_id = str(uuid.uuid4())
    prompt = {
        "1": {"class_type": "StudioProbe", "inputs": {"request_json": json.dumps({"title": "Runtime acceptance " + client_id[:8], "look": "studio"})}},
        "2": {"class_type": "SaveImage", "inputs": {"images": ["1", 0], "filename_prefix": "IntuitiveStudio/acceptance-probe"}},
    }
    status, queued = request("/prompt", {"prompt": prompt, "client_id": client_id})
    assert status == 200, queued
    for _ in range(30):
        _, history = request("/history/" + queued["prompt_id"])
        result = history.get(queued["prompt_id"])
        if result:
            assert result["status"]["status_str"] == "success", result["status"]
            output = result["outputs"]["2"]["images"][0]
            print(json.dumps({"result": "PASS", "paidRequests": 0, "workflows": 10,
                              "allowedModels": 10, "probePromptId": queued["prompt_id"], "probeOutput": output}, indent=2))
            return
        time.sleep(1)
    raise RuntimeError("No-cost probe did not finish within 30 seconds")


if __name__ == "__main__":
    main()
