# Browser Speech

Local browser text-to-speech for Windows with downloadable Pocket voices.

## Quick Start for Windows

1. Clone this repo or click GitHub `Code` -> `Download ZIP`.
2. Extract the ZIP to a folder on your PC if you downloaded it that way.
3. Run `PocketTtsCompanionSetup.exe`.
4. Open `chrome://extensions` or `edge://extensions`.
5. Turn on `Developer mode`.
6. Click `Load unpacked`.
7. Select the `extension/` folder from this repo.
8. Open the Browser Speech panel.
9. Download voices and test a Pocket voice.

## What Is In This Repo

- `PocketTtsCompanionSetup.exe`
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

Browser Speech uses Pocket TTS model assets by Kyutai, licensed under CC-BY-4.0.

