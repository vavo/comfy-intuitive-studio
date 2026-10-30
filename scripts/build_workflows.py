"""Generate native App Mode documents, no inferred node types."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def graph(node_type, request, name, kind="image"):
    save_type = "SaveImage" if kind == "image" else "SaveVideo"
    return {"id": "d8e0d814-59c4-4c41-b92e-f8a6167ae011", "revision": 0, "last_node_id": 2,
        "last_link_id": 1, "version": 0.4, "config": {}, "groups": [],
        "nodes": [
            {"id": 1, "type": node_type, "pos": [80,80], "size": [420,600], "flags": {}, "order":0,
             "mode":0, "inputs": [], "outputs": [{"name":kind.upper(),"type":kind.upper(),"links":[1]}],
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
