# Troubleshooting

## No sound

- Confirm the companion panel shows the runtime as ready.
- Confirm voices have been downloaded.
- Try a built-in Pocket voice first.

## Extension does not appear

- Open `chrome://extensions` or `edge://extensions`.
- Confirm `Developer mode` is on.
- Reload the unpacked extension after setup.

## Voices are missing

- Open the panel and run the voice download/setup step.
- Wait for warmup to complete before testing.

## Warmup hangs or speech fails on a laptop GPU

- If setup stops during warmup or longer speech requests fail, your GPU may not meet Pocket runtime requirements.
- Low VRAM or unsupported CUDA capability can allow install to complete while still preventing reliable Pocket voice playback.
- Pocket runtime is best supported on modern Nvidia RTX GPUs with `6 GB VRAM` minimum and `8 GB` preferred.

## Still stuck

- Rerun `setup\PocketTtsCompanionSetup.exe`.
- Reload the unpacked extension.

