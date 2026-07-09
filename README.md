# Browser Speech
### Adds high-quality local neural voices anywhere 
### your browser TTS tools already let you pick a voice.
 
<img width="344" height="277" alt="image" src="https://github.com/user-attachments/assets/c55ef7fb-5227-4add-be27-e812c58202d9" />
"C:\Users\Jim\Downloads\PKTTS.mp4"
<img width="320" height="385" alt="image" src="https://github.com/user-attachments/assets/34d98309-62de-4aed-8e84-b02731924c69" />

##
High-quality, fully local text-to-speech for Windows. No cloud voice processing. No subscriptions. No accounts required.

Any browser-based app or extension that uses the browser/Microsoft voice selection surface can immediately access Browser Speech’s local Pocket TTS voices, giving it higher-quality local neural voices instead of being limited to the default lower-quality local voices.

Supports voice cloning from as little as 10 seconds of voice audio.

After setup, Pocket voices appear as voice choices in apps that use browser speech APIs.

Optimized for offline use after setup, using a local Pocket TTS model.

## Quick Start for Windows

1. Clone this repo or click GitHub `Code` -> `Download ZIP`.
2. Extract the ZIP to a folder on your PC if you downloaded it that way.
3. Open `setup/` and run `PocketTtsCompanionSetup.exe`.
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





