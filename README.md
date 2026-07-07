# Browser Speech

High-quality, fully local text-to-speech for Windows. No cloud voice processing. No subscriptions. No accounts required.

Supports voice cloning from as little as 10 seconds of voice audio.

After setup, Pocket voices appear as voice choices in apps that use browser speech APIs.

Optimized for offline use after setup, using a local Pocket TTS model.

## Quick Start for Windows

1. Clone this repo or click GitHub `Code` -> `Download ZIP`.
2. Extract the ZIP to a folder on your PC if you downloaded it that way.
3. Double-click `Browser Speech Setup.vbs` from the top level of the extracted folder.
   If needed, you can also open `setup/` and run `PocketTtsCompanionSetup.exe` directly.
4. Open `chrome://extensions` or `edge://extensions`.
5. Turn on `Developer mode`.
6. Click `Load unpacked`.
7. Select the `extension/` folder from this repo.
8. Pin the Browser Speech icon to the toolbar.
9. Open the Browser Speech panel by clicking the pinned icon.
10. Test a Pocket voice.
11. Clone additional voices as needed.

## Hardware Note

- Browser Speech is designed for Nvidia RTX `30xx`, `40xx`, and `50xx` GPUs.
- It may also run on certain Nvidia `MX550` systems if enough VRAM is available, but that path is not treated as primary supported hardware.
- On low-VRAM or unsupported CUDA hardware, setup may install correctly but Pocket runtime warmup or longer speech requests can fail.
- Recommended supported Pocket runtime targets are modern Nvidia GPUs with `6 GB VRAM` minimum and `8 GB` preferred.

## Browser Support

- Current stable releases of Chrome or Edge are recommended.
- You do not need a special developer build, but the browser must support loading the included Manifest V3 extension.

## What Is In This Repo

- `Browser Speech Setup.vbs` top-level launcher for the installer
- `setup/` installer app, runtime files, and `payload/`
- `extension/` for browser `Load unpacked`
- `pocket-tts-model-minimal.json`
- documentation and troubleshooting

## Model Assets

The model manifest in this repo points to static hosted files used during setup:

- `model.safetensors`
- `tokenizer.model`
- `alba.safetensors`
- `anna.safetensors`
- `michael.safetensors`

See `MODEL-ASSETS.md` for details.

## Notes

- Internet is required the first time you download voices.
- Voice playback runs locally on your machine after setup.
- The unpacked extension is included here while browser store approval is pending.

## Troubleshooting

See `TROUBLESHOOTING.md`.

## Attribution

Browser Speech uses Pocket TTS model assets by Kyutai, licensed under CC-BY-4.0, and the `audio.cpp` runtime by 0xShug0, licensed under Apache-2.0.

