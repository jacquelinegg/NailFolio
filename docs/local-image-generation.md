# Local Image Generation

NailFolio can generate reference images on the local GPU through ComfyUI. This avoids per-image Gemini/OpenAI image API charges.

## Start ComfyUI

Run `D:\ComfyUI\start-nailfolio.bat` and leave its terminal open. The portable ComfyUI server listens only on `127.0.0.1:8188`; paid partner/API nodes are disabled.

The local install uses the fp16 Realistic Vision 5.1 SD 1.5 checkpoint in `D:\ComfyUI\ComfyUI_windows_portable\ComfyUI\models\checkpoints` and a 512x768 low-VRAM workflow for the RTX 3050 4GB GPU.

## NailFolio Settings

`.env` should contain:

```dotenv
IMAGE_PROVIDER=local
COMFYUI_URL=http://127.0.0.1:8188
COMFYUI_CHECKPOINT=Realistic_Vision_V5.1_fp16-no-ema.safetensors
```

Restart the Next.js server after changing `.env`. Local generated PNGs are previewed directly from ComfyUI, so the free Nail of the Day preview does not need a storage API key.

This provider works when the browser and Next.js server can reach the ComfyUI process on the same computer. A remotely hosted Next.js server cannot use a developer laptop's `127.0.0.1`; in that case the app must be self-hosted with ComfyUI, or use another provider. The local preview URL is not public, so YouCam cannot fetch it; try-on needs a publicly accessible uploaded reference and its separate transfer API may still have usage charges.
