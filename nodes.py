"""No-cost probe used to verify real ComfyUI execution and custom App Mode UI."""
import json
import numpy as np
import torch
from PIL import Image, ImageDraw


class StudioProbe:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"request_json": ("STRING", {"default": '{"title":"App Mode capability proof","look":"studio"}', "multiline": True})}}

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "execute"
    CATEGORY = "Intuitive Studio"

    def execute(self, request_json):
        state = json.loads(request_json)
        colors = {"studio": (195, 223, 195), "sunset": (246, 179, 133), "night": (165, 167, 223)}
        color = colors.get(state.get("look"), colors["studio"])
        image = Image.new("RGB", (768, 512), (24, 27, 29))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((42, 40, 726, 472), radius=30, outline=color, width=3)
        draw.ellipse((440, 110, 650, 320), fill=color)
        draw.text((80, 130), "INTUITIVE STUDIO", fill=color, font_size=26)
        draw.text((80, 200), str(state.get("title", "App Mode capability proof"))[:38], fill="white", font_size=20)
        draw.text((80, 370), "CPU capability test / no inference / $0", fill=color, font_size=18)
        return (torch.from_numpy(np.asarray(image).astype(np.float32) / 255)[None,],)


NODE_CLASS_MAPPINGS = {"StudioProbe": StudioProbe}
NODE_DISPLAY_NAME_MAPPINGS = {"StudioProbe": "Intuitive Studio · Capability probe"}
