# Native App Mode capability report

Baseline: ComfyUI 0.43.0 / frontend 1.57.6. Checked 2026-10-30.

## What works

| Capability | Mechanism | Evidence |
|---|---|---|
| Local custom graphics | SVG inside `addDOMWidget` | Three selectable lighting/motion illustrations render in native App Mode |
| Custom HTML controls | DOM widget hosted by Vue `WidgetDOM` | Prompts, dropdowns, numeric controls, file pickers and disclosure panels |
| Contextual controls | Extension renders the filtered server catalog | Changing model updates fields; all ten workflow choices remain visible |
| Native execution | `StudioImage` / `StudioVideo` → native save node | Real queue and output viewer; no separate generation frontend |
| One-click next stage | Native `app.loadGraphData` with a workflow filename | Owned asset reference carries from edit to animation |
| Secret isolation | Server-side Forma client | Browser receives only model catalog, quote and asset references |
| Retry identity | Account + session + take + request hash | Same request recovers its original job; new take is explicit |
| Portable app definition | `.app.json` with linearMode/linearData | Templates open directly in native App Mode |

## Where the boundary is

App Mode's native layout is a results area and inputs area, with responsive views.
Its schema exposes selected input/output nodes, labels, descriptions and input
height. It does not expose an arbitrary page designer, global branding layout,
project dashboard, timeline or multi-page application router.

A custom DOM widget can render HTML, CSS, SVG, images and ordinary browser controls
**inside its allotted input area**. That is the useful extension point. Our code
keeps CSS scoped to `.intuitive-studio` and uses no frontend fork or monkey-patch.
The visual preset cards are prompt recipes; they are not ControlNet or guaranteed
physical camera controls. All generated output is still model-dependent.

Notes and MarkdownNote are explicitly excluded as App Mode nodes in the inspected
store. Drawing a node on the graph canvas does not make its drawing appear in App
Mode. Native Comfy Cloud share links do not provide a local sharing service; local
users need the extension and workflow file. Sharing/export does not include the
server's Forma key, but media asset references belong to the originating account.

The local Templates browser still lists Comfy's general model/partner templates.
`--disable-partner-nodes` prevents registering those native partner nodes. The
Studio catalog itself exposes only the verified policy entries. We do not replace
Comfy's global navigation or pretend that the whole installation is a kiosk.

## Source-level evidence

- [Official App Mode guide](https://docs.comfy.org/interface/app-mode)
- [Pinned DOM widget component](https://github.com/Comfy-Org/ComfyUI_frontend/blob/v1.57.6/src/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue)
- [Pinned App Mode store](https://github.com/Comfy-Org/ComfyUI_frontend/blob/v1.57.6/src/stores/appModeStore.ts)
- [Workflow metadata schema](https://github.com/Comfy-Org/ComfyUI_frontend/blob/v1.57.6/src/platform/workflow/management/stores/comfyWorkflow.ts)
- [Native graph loader signature](https://github.com/Comfy-Org/ComfyUI_frontend/blob/v1.57.6/src/scripts/app.ts)

The loader's fourth argument is the workflow filename/object, not an options map.
This difference was found and fixed through a real result hand-off test.

## Widget lifecycle finding

The pinned App Mode list keys widgets by their node/widget identity. Reusing node
IDs 1/2 across every app can reuse a mounted DOM host after a tab switch, leaving
the next custom panel empty. Bundled workflows now have distinct stable node IDs.
This fixes the reproduced tab-switch cycle without modifying ComfyUI. Request
recovery uses the saved session/take, so changing graph IDs does not buy new jobs.

## Studio controls (2026-11-01)

- Six bundled photographic modifier cards use Z-Image Turbo through Forma → Runpod Public Endpoints. Prompts and job IDs are in `web/assets/provenance.json`; generation cost was six cents. The photographs illustrate lighting and framing, not guaranteed model output.
- Uploads preview images, video and audio. Existing `asset:` references load through a same-origin, header-guarded server proxy; credentials never reach the browser. Temporary downloads are deleted after reading, and previews are not persisted in workflow JSON.
- Dimensions use model-specific dropdowns. Width/height models offer 768×1024, 1024×1024 and 1024×768, retaining an existing custom pair. Enumerated model sizes retain their full catalog choices. InfiniteTalk offers 480p/720p; Qwen Image Edit has no size parameter.
- WAN 2.1 duration stops are 5/10/15 seconds, WAN 2.2 stops are 5/8/10/15. These are documented pricing tiers; other lengths are rejected before submission. Sources: https://docs.runpod.io/public-endpoints/models/wan-2-1-i2v and https://docs.runpod.io/public-endpoints/models/wan-2-2-i2v.
- Size presets on free-form endpoints conform to their documented width*height input format. The hosted worker may derive the final aspect ratio from the input image. Every size has not been purchased for live inference validation.
- Workflow selection reuses the active native workflow object. Per-stage graph state and output references are saved under `extra.studio_stages`, without recursive copies. Existing unrelated tabs stay intact. The native duplicate panel title is hidden only when a Studio app is present.

### Camera modifier previews

Gentle push and Slow orbit use silent looping H.264 clips of the same vase. Gentle push is a six-second deterministic zoom illustration from the source photograph. Slow orbit uses a Forma/WAN 2.2 generation with actual perspective change, trimmed and reversed for a repeating loop. Locked shot keeps the source photograph stationary. These illustrate the prompt modifiers; they are not a guarantee of a particular model's camera control.

Previews play only while visible and stop when the form is replaced. Play/Pause previews affects both clips without changing the selected modifier. Reduced-motion users start with still posters and can opt into playback.

### Aspect ratio and resolution

Dimension fields now separate the exact aspect ratio from resolution. Within each ratio, choices are sorted by pixel area and labeled Low/High (Medium for intermediate sizes). Changing ratio retains Low or High where possible. Existing custom width/height values remain selectable.

FLUX Dev/Schnell and the flexible Kontext/Qwen size inputs offer square 768×768 / 1024×1024, portrait 768×1024 / 1152×1536, and wide 1024×768 / 1536×1152. WAN size requests offer wide 640×360 / 1280×720, portrait 360×640 / 720×1280, and square 480×480 / 960×960. These are requested dimensions; hosted I2V workers can derive the delivered aspect ratio from the starting asset. New resolution pairs have been validated in the form and request policy, not purchased for inference testing.

Z-Image and Qwen Edit 2511 retain their documented enumerations. A ratio with one native size shows Native plus a limitation notice; no synthetic upscaling/downscaling is silently applied. InfiniteTalk labels its 480p/720p choices Low/High. Qwen Image Edit exposes no output-size input. Sources checked 2026-11-01: https://docs.runpod.io/public-endpoints/models/z-image-turbo and https://docs.runpod.io/public-endpoints/models/qwen-image-edit-2511.

### Connect Forma

Every Studio workflow now includes a Connect Forma section with a masked key
field, Save and connect, and Check connection. A no-cost `/wallet` request verifies
credentials before saving; a failed replacement preserves the previous key.
Saved keys override server environment keys. Status distinguishes the saved key
from the server fallback and supports retry after a connection failure.

The key is stored under the ComfyUI base directory at `.forma/api.key` (file mode
0600, directory 0700), outside the HTTP-served user directory. It is shared by
workflows on that server, never returned to the browser or placed in graph data.
The browser clears the input on submission; connection responses use no-store.
Changing accounts does not migrate existing asset references or reset the spend
ledger. The server fallback credential file is never modified.

### Workflow launcher in the empty preview

Studio replaces the native App Mode tutorial with an icon grid when the native
`linear-welcome` empty state is present. The four available workflow types switch
through the existing stage-preserving handler in the same tab. All six unavailable
types remain visible in an expandable section, with disabled buttons.

This is a scoped extension DOM integration against the pinned frontend 1.57.6,
not a supported ComfyUI empty-state slot. It uses `linearCenterPanel` and
`data-testid="linear-welcome"`; recheck these selectors on frontend upgrades.
It does not replace the media renderer and unmounts when the welcome element or
Studio control panel disappears. Other apps retain the native welcome.

Browser QA at 1280×720 verified Create → Edit → Animate → Create, unchanged tab
count and restored prompt, unavailable buttons, and removal/recreation when
switching between graph and App Mode. No browser errors. No new inference was
purchased; a new-result transition was not exercised in this pass.
