# Intuitive Studio

Create an image, edit it, and animate the result in one ComfyUI App Mode tab.
A Forma key pays for generation on Runpod Public Endpoints with published model
weights. Your computer runs the interface on CPU. No model download is required.

## Install and start

On macOS or Linux, install Git and **uv**. On macOS with Homebrew, run
`brew install uv`. For other installation methods, see [Installing uv](https://docs.astral.sh/uv/getting-started/installation/).

With access to this private repository, run:

```sh
git clone https://github.com/vavo/comfy-intuitive-studio.git
cd comfy-intuitive-studio
./start.sh
```

The first launch downloads ComfyUI and installs Python 3.12 dependencies, including
PyTorch, into a private environment. Allow several GB of free space. Once the
terminal reports that the server is ready, **[open Intuitive Studio](http://127.0.0.1:8190/?template=text-to-image.app&source=comfy-intuitive-studio&mode=linear)**.
The link opens the Create workflow in App Mode. On the first visit, click **Skip**
to go straight past ComfyUI’s welcome tour. You can also open
`workflows/text-to-image.app.json` with ComfyUI’s **Open** command.

To stop, press **Ctrl+C** in that terminal. To come back, run `./start.sh` again
and [resume your ComfyUI workspace](http://127.0.0.1:8190/).
If port 8190 is busy, run `STUDIO_PORT=8191 ./start.sh` and use the URL it prints.

## Make your first image

1. Expand **Connect Forma**, paste your key from Forma Account settings and click
   **Save and connect**. Wait for **Connected**. You can change the key here later.
2. Choose **Create an image**, enter a prompt, pick a size and click **Check price**.
   **Run** submits the generation against your Forma balance.
3. Click **Edit this result** or **Animate this result** to carry the image into
   the next workflow. **Choose workflow** opens the launcher over the result.
   **Back to results** returns to the selected image or video with its settings.

To try App Mode before connecting Forma, open the
[free CPU probe](http://127.0.0.1:8190/?template=capability-probe.app&source=comfy-intuitive-studio&mode=linear)
and click **Run**. It renders a test image locally.

## Already running ComfyUI?

From your ComfyUI install directory, run:

```sh
git clone https://github.com/vavo/comfy-intuitive-studio.git custom_nodes/comfy-intuitive-studio
```

Restart ComfyUI and open **Templates → Extensions → comfy-intuitive-studio →
text-to-image.app**. Connect Forma in the app. This route uses your existing
server, port and Python environment. The tested combination is ComfyUI **0.43.0**
and frontend **1.57.6**. The standalone installer pins both for you.

## Workflows, spending and storage

Create, Edit, Animate and Talking portrait have enabled endpoints. Six additional
workflows are bundled and labelled as awaiting a compatible endpoint. Runpod is a
hackathon partner. The exact hosted variants and open-weights competition
eligibility are documented in the [endpoint findings](docs/ENDPOINTS.md).

The default cumulative spending limit is **300 US cents**. Each workflow also
has a per-run limit. **New take** requests a fresh generation. Repeating an
unchanged request recovers the same job. Uncertain submissions still count
toward the local limit. Keep the ledger when updating or retrying.

The standalone install keeps the following files under the ignored
`.runtime/` directory:

| File or directory | Purpose |
| --- | --- |
| `data/.forma/api.key` | Key saved by Connect Forma, shared across workflows on this local server |
| `data/.intuitive-studio/spend.sqlite3` | Cumulative spend ledger |
| `data/output/IntuitiveStudio/` | Generated images and videos |
| `data/user/default/workflows/` | Workflows you save in ComfyUI |
| `local.env` | Optional shell settings for this installation |

The launcher binds to loopback. Workflow exports omit the key. To supply a server
fallback key, set `FORMA_API_KEY_FILE` to its absolute path. An app-saved key takes
precedence. To reuse an existing ComfyUI Python environment for the standalone
server, set `STUDIO_PYTHON` to its absolute executable path in `.runtime/local.env`.
Setup installs the pinned overlay packages separately.

To update your clone, stop the server, run `git pull --ff-only`, then `./start.sh`.
Keep `.runtime/data` when backing up or moving your work.

[Verification and test commands](docs/QA.md) · [App Mode capabilities](docs/CAPABILITIES.md) ·
[Implementation plan](docs/IMPLEMENTATION_PLAN.md) · [Model policy](model-policy.json) ·
[License](LICENSE) · [Forma attribution](NOTICE.md)
