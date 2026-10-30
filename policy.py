"""Model openness and provider route policy, enforced before network calls."""
import json
import math
from pathlib import Path
from .vendor.catalog import MODELS, WORKFLOWS, model_fields as snapshot_fields, prepare_inputs, field_id
from .vendor.client import FormaError

MANIFEST = json.loads((Path(__file__).parent / "model-policy.json").read_text())
ALLOWED = {entry["id"] for entry in MANIFEST["models"] if entry["status"] == "enabled"}
ALL_WORKFLOWS = [mode for modes in WORKFLOWS.values() for mode in modes]
BLOCKED_FIELDS = {"loras", "lora", "lora_url", "enable_prompt_optimization", "enable_prompt_expansion", "prompt_upsampling"}


def model_fields(model, workflow):
    fields = snapshot_fields(model, workflow)
    if model["id"] == "wan-2-2-i2v-720":
        for field in fields:
            if field["name"] == "duration":
                # Live worker rejected 3s; documented duration tiers, checked 2026-10-30.
                field.update(choices=[5, 8, 10, 15], default=5)
    return fields


def catalog():
    models = []
    for key in ALLOWED:
        model = dict(MODELS[key])
        model["fields"] = [f for f in model_fields(model, "") if f["name"] not in BLOCKED_FIELDS]
        models.append(model)
    return {"models": sorted(models, key=lambda m: m["name"]), "workflows": ALL_WORKFLOWS,
            "provider": "Forma → Runpod Public Endpoints", "categoryEligibility": "unconfirmed"}


def validate(raw, expected_kind=None):
    if not isinstance(raw, str) or len(raw) > 65536:
        raise FormaError("Studio request must be JSON under 64 KB.")
    try:
        state = json.loads(raw)
    except (ValueError, TypeError):
        raise FormaError("Studio request is not valid JSON.") from None
    if not isinstance(state, dict) or set(state) - {"model", "workflow", "values", "run", "cap", "session", "look"}:
        raise FormaError("Unknown Studio request fields.")
    model_id, workflow = state.get("model"), state.get("workflow")
    if not isinstance(model_id, str) or model_id not in ALLOWED:
        raise FormaError("No verified open-weight Runpod endpoint is selected for this workflow.")
    model = MODELS[model_id]
    if workflow not in ALL_WORKFLOWS or workflow not in model["workflows"]:
        raise FormaError("This workflow has no compatible verified endpoint selected.")
    if expected_kind and model["kind"] != expected_kind:
        raise FormaError("Select the matching image or video app before running.")
    values = state.get("values", {})
    if not isinstance(values, dict) or set(values) & BLOCKED_FIELDS:
        raise FormaError("Unreviewed LoRAs and prompt enhancement are not enabled.")
    if any(isinstance(value, float) and not math.isfinite(value) for value in values.values()):
        raise FormaError("Numeric fields must be finite.")
    run, cap = state.get("run", 1), state.get("cap", 0)
    if type(run) is not int or not 1 <= run <= 2147483647:
        raise FormaError("Run number must be a positive integer.")
    if type(cap) is not int or not 0 <= cap <= 300:
        raise FormaError("Per-run limit must be 0–300 USD cents.")
    import uuid
    try:
        session = str(uuid.UUID(state["session"]))
    except (KeyError, ValueError, TypeError, AttributeError):
        raise FormaError("Studio request needs a persistent session ID.") from None
    converted = {"model": model_id}
    for field in model_fields(model, workflow):
        name, key = field["name"], field_id(field)
        if name in BLOCKED_FIELDS:
            continue
        if field.get("media"):
            value = values.get(name, "")
            if not isinstance(value, str):
                raise FormaError("Reference fields must contain asset references or HTTPS URLs.")
            converted[key] = {key: "Reference" if value.strip() else "None", "value": value}
        elif name in values:
            value = values[name]
            if field.get("choices") and value not in field["choices"]:
                raise FormaError(f"Choose a supported {field['label'].lower()}.")
            if field["type"] == "boolean" and type(value) is not bool:
                raise FormaError("Boolean fields must be true or false.")
            if field["type"] == "integer" and type(value) is not int:
                raise FormaError("Integer fields must be whole numbers.")
            converted[key] = value
    known = {f["name"] for f in model_fields(model, workflow)}
    if set(values) - known:
        raise FormaError("Inputs do not belong to the selected model.")
    inputs, prompt = prepare_inputs(model, workflow, converted)
    for field in model_fields(model, workflow):
        name = field["name"]
        if field.get("media") and values.get(name, "").strip():
            refs = [v.strip() for v in values[name].splitlines() if v.strip()]
            inputs[name] = refs if field["type"] == "array" else refs[0]
        if name in BLOCKED_FIELDS and field["type"] == "boolean":
            inputs[name] = False
    return state, {"modelId": model_id, "kind": model["kind"], "workflow": workflow,
                   "prompt": prompt, "inputs": inputs}, session
