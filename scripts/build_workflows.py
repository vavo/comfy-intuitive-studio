"""Generate native App Mode documents, no inferred node types."""
import json
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def graph(node_type, request, name, kind="image"):
    save_type = "SaveImage" if kind == "image" else "SaveVideo"
    return {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, "intuitive-studio:" + name)), "revision": 0, "last_node_id": 2,
        "last_link_id": 1, "version": 0.4, "config": {}, "groups": [],
        "nodes": [
            {"id": 1, "type": node_type, "pos": [80,80], "size": [420,600], "flags": {}, "order":0,
             "mode":0, "inputs": [], "outputs": [{"name":kind.upper(),"type":kind.upper(),"links":[1]}] + ([] if node_type == "StudioProbe" else [{"name":"forma_reference", "type":"STRING", "links":[]}]),
             "properties": {"Node name for S&R": node_type}, "widgets_values":[json.dumps(request)]},
            {"id": 2, "type": save_type, "pos": [590,80], "size": [420,400], "flags": {}, "order":1,
             "mode":0, "inputs": [{"name":"images" if kind=="image" else "video", "type":kind.upper(), "link":1}],
             "outputs": [], "properties": {"Node name for S&R":save_type},
             "widgets_values": ["IntuitiveStudio/"+name] if kind=="image" else ["IntuitiveStudio/"+name,"auto","auto"]}],
        "links":[[1,1,0,2,0,kind.upper()]],
        "extra":{"linearMode":True,"linearData":{"inputs":[[1,"studio_panel"]],"outputs":[2]},
                 "ds":{"scale":.8,"offset":[0,0]}}}


if __name__ == "__main__":
    data = graph("StudioProbe", {"title":"App Mode capability proof","look":"studio"}, "capability-probe")
    (ROOT/"workflows"/"capability-probe.app.json").write_text(json.dumps(data,indent=2)+"\n")

    policy = json.loads((ROOT / "model-policy.json").read_text())
    allowed = {m["id"] for m in policy["models"] if m["status"] == "enabled"}
    models = [m for m in json.loads((ROOT / "vendor/models.json").read_text()) if m["id"] in allowed]
    defaults = {"text-to-image":"black-forest-labs-flux-1-schnell", "image-to-image":"qwen-image-edit-2511", "image-to-video":"wan-2-2-i2v-720", "talking-portrait":"infinitetalk"}
    modes = ["text-to-image", "image-to-image", "text-to-video", "image-to-video", "first-last-frame-to-video", "reference-to-video", "video-to-video", "audio-to-video", "talking-portrait", "motion-transfer"]
    for mode in modes:
        kind = "image" if mode in modes[:2] else "video"
        compatible = [m for m in models if mode in m["workflows"]]
        selected = next((m for m in compatible if m["id"] == defaults.get(mode)), compatible[0] if compatible else None)
        values = {f["name"]: f["default"] for f in (selected or {}).get("fields", []) if "default" in f and not f.get("media") and f["name"] not in {"enable_safety_checker", "enable_prompt_optimization", "enable_prompt_expansion", "prompt_upsampling"}}
        values["prompt"] = "A small ceramic lighthouse on a wooden desk, soft daylight, detailed product photograph" if mode == "text-to-image" else ""
        if mode == "text-to-image": values.update(width=512, height=512)
        if mode == "image-to-video": values.update(duration=3, size="1280*720")
        state = {"workflow":mode,"model":selected["id"] if selected else "", "values":values,"cap":10 if kind=="image" else 50,"run":1,"session":str(uuid.uuid5(uuid.NAMESPACE_URL,"studio-session:"+mode))}
        (ROOT/"workflows"/(mode+".app.json")).write_text(json.dumps(graph("Studio"+kind.title(),state,mode,kind),indent=2)+"\n")
