# Endpoints and model-weight policy

Checked 2026-10-30. Required route:
**ComfyUI App Mode → Forma API → Runpod Public Endpoints**.
Runpod is a hackathon partner. Forma supplies authentication, owned asset storage,
quotes, billing and request recovery. Studio does not ask for a Runpod key.

## Enabled models

Ten exact catalog entries have published base weights: FLUX.1 Schnell, FLUX.1 Dev,
FLUX.1 Kontext Dev, Qwen Image, Qwen Image Edit, Qwen Image Edit 2511, Z-Image Turbo,
WAN 2.1 I2V 720p, WAN 2.2 I2V 720p and InfiniteTalk. Exact model-card/license and
Runpod documentation URLs are in [model-policy.json](../model-policy.json).
Open weights does not mean all licenses are Apache/MIT; FLUX Dev variants have
additional license terms. Model-card verification cannot attest to the internals
of a hosted worker. The route is verified from Forma's catalog/adapter and live
job metadata, which reports `provider=runpod` and the exact endpoint ID.

Closed or unverified weight releases are excluded from execution. Unverified
optimized/LoRA variants remain pending. Custom LoRA inputs and prompt enhancement
are blocked because their exact model provenance has not been verified. All fal
routes are excluded even when their model weights are public.

## Preserved workflows

| Workflow | Current compatible verified catalog entries |
|---|---|
| Text → image | 4 |
| Image → image | 4 |
| Image → video | 2 |
| Talking portrait | 1 |
| Text → video | Awaiting compatible endpoint |
| First + last frame → video | Awaiting compatible endpoint |
| References → video | Awaiting compatible endpoint |
| Video → video | Awaiting compatible endpoint |
| Audio → video | Awaiting compatible endpoint |
| Motion transfer | Awaiting compatible endpoint |

No workflow was removed. Visible unavailable entries reject server execution.
The vendor snapshot retains original catalog data for provenance, but the runtime
catalog and validation are restricted by the explicit allowlist.

## LTX 2.5 and MiniMax H3

**Public APIs exist, but the mandatory Forma → Runpod Public Endpoint chain is not
verified for either model.** Neither appears in the current Forma visual catalog.
The current Runpod Public Endpoints documentation index has MiniMax speech, but
no matching H3 video or LTX 2.5 endpoint. Absence from documentation is not proof
that an unannounced/private service does not exist. No endpoint IDs are guessed.

- [LTX 2.5 API](https://docs.ltx.io/models/ltx-2-5/) documents Fast/Pro variants and
  video generation modes. [Published weights](https://huggingface.co/Lightricks/LTX-2.5)
  and the [LTX Desktop model notes](https://github.com/Lightricks/LTX-Desktop/blob/main/docs/models-and-loras.md)
  must be matched to the exact API variant: Pro is API-only, so it is not enabled
  merely because another LTX variant publishes weights.
- [MiniMax API pricing](https://platform.minimax.io/subscribe/token-plan?tab=api-enterprise)
  lists H3. Exact weight/license eligibility must be checked for the served variant,
  including territorial restrictions; [official licensing route](https://platform.minimax.io/h3-license).
- Runpod's [LTX 2.5 guide](https://www.runpod.io/blog/ltx-2-5-the-open-weights-world-model-built-for-speed-and-how-to-run-it-on-runpod)
  and [H3 guide](https://www.runpod.io/blog/minimax-h3-the-open-weight-omni-modal-video-model-and-what-it-takes-to-run-it)
  describe self-hosting on GPU infrastructure. A pod deployment is not a Public
  Endpoint and would bypass the required Forma route unless Forma integrates it.
- [Runpod documentation index](https://docs.runpod.io/llms.txt)

Add either model only after confirming exact published weights, served variant,
license, Runpod Public Endpoint ID and Forma integration. The current prototype
needs no speculative adapter for an unavailable route.

## Competition boundary

The [hackathon page](https://comfy.org/open-source-higgsfield) requires open-weight
models and excludes partner nodes/closed-source APIs in that category. Published
weights do not establish organizer approval of a proprietary hosted API route.
The mandatory Forma architecture remains unchanged; category acceptance is marked
**unconfirmed**. No organizer was contacted and no entry was submitted.

## Live compatibility corrections

WAN 2.2 rejected a 3-second clip even though the inherited catalog accepted 1–15.
Studio now uses the documented 5/8/10/15-second tiers and defaults to five seconds.
See [Runpod WAN 2.2 documentation](https://docs.runpod.io/public-endpoints/models/wan-2-2-i2v).
The original MIT vendor snapshot is unchanged; the correction lives in Studio's
policy layer. Invalid durations are rejected before a quote or submission.
