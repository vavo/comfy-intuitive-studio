# Intuitive Studio capability prototype

2026-10-30. Implementation plan written before application code.

## Decision and scope

Build a ComfyUI custom-node package whose primary surface is native App Mode.
Forma is the mandatory inference and balance provider. Do not substitute Comfy
Cloud, direct model APIs, or pod inference. No changes to either Forma repository.
Preserve all ten existing visual workflows: text-to-image, image-to-image,
text-to-video, image-to-video, first-last-frame-to-video, reference-to-video,
video-to-video, audio-to-video, talking-portrait, and motion-transfer.
Keep every verified open-weight model supported by those workflows. Unsupported
workflows remain visible with a specific explanation; no fake generation.

This is a capability prototype, not a competition submission or production launch.
User authorized private GitHub repository, main branch, and up to USD 3 of Forma
inference. Never submit the competition entry or publish social posts here.

## Acceptance criteria

1. Opens in genuine ComfyUI App Mode, without a separate imitation website.
2. A custom DOM widget displays bundled graphics, visual choices, contextual
   controls and model selection inside the native App Mode input column.
3. A request made in the app becomes a real ComfyUI queued node execution.
4. The server enforces an explicit model allowlist; editing JSON cannot select a
   closed model. Custom LoRA URLs are disabled until their exact weights are audited.
5. All ten workflow types remain discoverable, including unavailable ones.
6. Credentials remain server-side and absent from workflow files and screenshots.
7. Quote precedes generation; caps and request recovery use Forma's existing API.
8. App save/reload preserves inputs and custom graphics; graph/app switching works.
9. Desktop and narrow viewport controls remain usable and keyboard accessible.
10. Live evidence distinguishes image/video generation from deterministic UI tests.

## Research method and pinned baseline

Inspect official docs and source, then verify each claimed capability in the
released runtime. Research main frontend 02c801497234efa78e371d5d20629f2f49f22e0a
(1.60.0); runtime baseline frontend 1.57.6, source tag v1.57.6. Backend source
b5a432157de6b8884f81104cd02926adf4d597e4. Record actual test versions in QA.
Avoid a frontend fork. No package builds or multi-GB model downloads are needed.
The machine has about 5 GB free, so reuse existing Python libraries read-only and
install changed frontend packages into an isolated temporary directory.

## App Mode limits to test

- Native: select/reorder/rename widget inputs, output viewers, queue, graph toggle,
  saved workflow metadata (`extra.linearMode`, `extra.linearData`).
- Extension: arbitrary local HTML/SVG/image content through `addDOMWidget`, graphic
  preset buttons, conditional fields, quote/result status, stage navigation.
- Not a native app-layout API: arbitrary full-page branding, custom global routes,
  freeform multi-column layout or cross-workflow project state.
- Graph canvas drawing is not proof it appears in App Mode. Notes/MarkdownNote
  are explicitly excluded in the inspected App Mode store.
- Widgets are mounted into the App Mode input area; DOM lifecycle and state need
  save/reload and graph/app transition tests. Scope CSS to the widget only.
- Native sharing links are Comfy Cloud only per current docs. Distribute local
  workflow JSON plus the extension and setup instructions instead.

## Eligibility boundary

Competition says: "No partner nodes or closed-source APIs, open-weights models
only." Downloadable weights and an approved model card prove model openness,
not that a proprietary hosted execution route is accepted by the organizers.
Forma is mandatory, so category eligibility remains UNCONFIRMED pending explicit
organizer clarification. Do not label this prototype competition-approved.
Implement a model-openness allowlist, not a misleading eligibility badge.
Verify exact versions, including accelerators/LoRAs and prompt enhancement models.
Unverified endpoints stay excluded. Native partner nodes are disabled in runtime.

## Implementation sequence

### 1. Foundation and evidence

Create isolated package, plan, capability matrix, model decision manifest, license,
and pinned dependency provenance. Commit and push this reviewable starting point.

### 2. Native App Mode probe

Register a no-cost capability probe with a DOM widget and a deterministic image
output. Test local SVG graphics, form state, native queue/output, saving, reopening,
graph/app switching and mobile layout before implementing paid inference.

### 3. Forma studio nodes

Reuse the existing MIT-licensed Forma client with attribution and a pinned source
commit. Keep the client boundary small. Add server validation and Image/Video
nodes, no new billing system. The input widget renders the same validated catalog
used server-side. Unknown model IDs, unsupported modes and unreviewed LoRAs fail
before any quote, upload or generation call.

### 4. Workflow coverage and guided transitions

Bundle App Mode workflows for all ten types. Keep unavailable modes visible and
non-executable. Carry asset references into the next app through explicit user
actions. Preserve completed assets; never automatically rerun a paid stage.

### 5. Verification

Unit tests cover allowlist bypass, invalid workflow/model pairs, malformed request
JSON, no-backend modes, caps and deterministic probe behavior. Reuse client tests
where meaningful. Integration tests submit real /prompt jobs and inspect history.
Browser tests cover native App Mode graphics, model/workflow changes, keyboard
controls, queue result, save/reload and mobile layout. Run one bounded Forma image
job, edit and video where funding, permissions and endpoints permit, within USD 3.
If a stage fails, record it; don't substitute cached images as live evidence.

### 6. Handoff

Commit and push milestones (>200 changed lines), retain local runnable prototype,
README launch instructions, capability findings, eligibility gaps, inference spend,
and screenshots. No PR, public release, social post or competition submission.

## Design constraints

Use an extension-local graphical header and preset illustrations, not global CSS
that changes ComfyUI. Keep native queue, results and graph escape hatch. Form labels
use everyday language; technical settings remain available in a disclosure panel.
Use standard image/video Save nodes for durable files. The execution identity must
remain stable across timeout recovery; intentional new generations need a new run.

## Sources

- https://docs.comfy.org/interface/app-mode
- https://comfy.org/open-source-higgsfield
- https://github.com/Comfy-Org/ComfyUI_frontend/tree/v1.57.6
- https://github.com/Comfy-Org/ComfyUI
- https://github.com/vavo/runpod-endpoints-comfy
