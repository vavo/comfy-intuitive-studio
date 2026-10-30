# Intuitive Studio

A graphical studio **inside native ComfyUI App Mode**. It keeps ComfyUI's queue,
output viewer and editable graph, while replacing exposed node controls with
visual presets, contextual fields, price checks and explicit result hand-offs.

**ComfyUI App Mode → Forma API → Runpod Public Endpoints.** Your Forma key and
balance are required. No Comfy Cloud subscription, direct-provider key or local
GPU inference is used. Runpod is a partner of the Open Source Higgsfield hackathon.

This private capability prototype is not a competition submission. Open weights
are verified separately from competition eligibility, which remains unconfirmed.
See [model policy](model-policy.json) and [endpoint findings](docs/ENDPOINTS.md).

## Run

Tested baseline: ComfyUI 0.43.0 at commit
`b5a432157de6b8884f81104cd02926adf4d597e4`, frontend **1.57.6**.
Requires Git, Python with ComfyUI dependencies (Torch, NumPy, Pillow, aiohttp,
PyAV, etc.), and `uv` for isolated frontend dependencies. No model files are needed.
Runtime downloads are about 250 MB when reusing a ComfyUI Python environment.
A fresh Torch environment is substantially larger.

```sh
export STUDIO_PYTHON=/absolute/path/to/comfy-python/bin/python
export FORMA_API_KEY_FILE=/absolute/path/to/private/api.key
sh scripts/setup.sh
sh scripts/launch.sh
```

Open **http://127.0.0.1:8190**. In Templates → Extensions →
comfy-intuitive-studio, open `text-to-image.app`. Choose a look, enter a prompt,
check the price, then use the native **Run** button. The template picker currently
labels extension templates "Node graph", but they open in genuine App Mode.

After image completion, **Edit this result** and **Animate this result** open the
next native workflow with the owned Forma asset reference filled in. These actions
do not purchase inference. Use **New take** only when intentionally purchasing a
different generation. Unchanged requests recover the same job.

`capability-probe.app` renders a deterministic CPU graphic for a no-cost setup test.
Its output is labelled as a test, not generated media.

For an existing ComfyUI installation, link this repository into its custom_nodes
folder and restart with frontend 1.57.6. Set the Forma key file on the server.
Never put keys in workflow JSON, the browser, Git or prompts. This prototype is
for a trusted, loopback-only ComfyUI server, not a public multi-user host.

## Budget and files

Default cumulative ceiling: **300 USD cents**. `STUDIO_BUDGET_CENTS` controls the
server ceiling; each app also has a per-run cap. The SQLite ledger reserves funds
**before** submission and counts uncertain or failed submissions conservatively.
It does not release reservations automatically. It does not replace Forma billing.
Do not delete/reset the ledger to retry a failed job.

- Runtime, outputs, saved workflows and ledger: ignored `.runtime/`.
- Ledger: `.runtime/data/.intuitive-studio/spend.sqlite3`.
- Native output files: `.runtime/data/output/IntuitiveStudio/`.
- Machine configuration: optional ignored `.runtime/local.env`.
- All ten workflow types are bundled. Six await a verified compatible endpoint and
  remain visible with an explanation. They cannot submit inference.

Setup never modifies Forma or its existing ComfyUI node package. The launcher
uses `--disable-partner-nodes` and binds only to `127.0.0.1`.

## Validation and findings

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

Read the [implementation plan](docs/IMPLEMENTATION_PLAN.md),
[App Mode capability report](docs/CAPABILITIES.md),
[endpoint research](docs/ENDPOINTS.md) and [verification record](docs/QA.md).
Code is MIT-licensed; model weights and external runtimes have separate licenses.
The Forma client/catalog snapshot is attributed in [NOTICE.md](NOTICE.md).

The preconfigured machine runtime can be started with `sh scripts/launch.sh` alone;
its ignored local configuration supplies the existing Python and Forma-key paths.
For no-cost runtime acceptance checks, run `python3 scripts/verify_runtime.py`.
See QA for the distinction between tested environment reuse and a fresh install.
