# Verification record

Work in progress, 2026-10-30. Do not treat unchecked items as completed.

- Actual ComfyUI 0.43.0 + frontend 1.57.6, CPU runtime on macOS arm64.
- Native App Mode custom SVG probe executed and saved a 768×512 test image.
- Twelve backend tests pass, including excluded models, unsupported workflow/kind,
  malformed input, budget reservation before network, failed-request conservation,
  idempotent reservation, recovery without local purchase and unsupported duration.
- Live Flux Schnell creation completed: quoted/reserved 1 cent.
- Live Qwen Image Edit 2511 completed using the created Forma asset: 4 cents.
- Native result hand-off to animation verified, with the owned reference prefilled.
- First WAN 2.2 attempt failed due to unsupported 3-second duration: 28 cents remain
  conservatively reserved locally. Forma returned FAILED and cost=null.
- Five-second animation test in progress.
- Desktop/narrow view, save/reopen, graph transitions, uploads and final clean-start
  checks still pending.

Known observation: Schnell request and Forma job inputs recorded 512×512 but the
returned image was 1024×1024. Studio displays the real returned dimensions. This
is an upstream endpoint behavior discrepancy; Forma was not modified.
