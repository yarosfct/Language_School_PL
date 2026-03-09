# Piper TTS Setup Guide

This guide will help you install and configure Piper TTS for high-quality, natural-sounding Polish text-to-speech in your Polish learning app.

## Why Piper TTS?

- **Natural-sounding voices**: Neural TTS models that sound much better than espeak-ng
- **Free and local**: No API costs, works completely offline
- **Fast**: Cached audio files for instant playback
- **Polish support**: Excellent Polish language support

## Installation

### 1. Install Piper TTS

On Arch Linux (or Arch-based distros):

```bash
yay -S piper-tts-bin
```

Or using paru:

```bash
paru -S piper-tts-bin
```

### 2. Download Polish Voice Models

The app needs Polish voice models to work. Download the medium-quality model (recommended):

```bash
# Create voices directory
mkdir -p public/voices
cd public/voices

# Download medium-quality Polish voice (female, ~50MB)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/mls_6892/medium/pl_PL-mls_6892-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/mls_6892/medium/pl_PL-mls_6892-medium.onnx.json
```

**Alternative voice models:**

#### High Quality (better sound, larger file ~100MB)
```bash
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/mls_6892/high/pl_PL-mls_6892-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/mls_6892/high/pl_PL-mls_6892-high.onnx.json
```

#### Low Quality (faster, smaller file ~25MB)
```bash
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/mls_6892/low/pl_PL-mls_6892-low.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/mls_6892/low/pl_PL-mls_6892-low.onnx.json
```

### 3. Verify Installation

Test that Piper TTS is working:

```bash
echo "Dzień dobry! Jak się masz?" | piper-tts --model public/voices/pl_PL-mls_6892-medium.onnx --output-file test.wav
aplay test.wav
```

You should hear the Polish text spoken with a natural voice.

### 4. Restart the Development Server

After installing Piper and downloading voice models, restart your Next.js development server:

```bash
# Stop the server (Ctrl+C)
# Then restart it
npm run dev
```

## Verification

1. Open the app in your browser: `http://localhost:3000`
2. Go to **Settings** page
3. Look for the **TTS Backend** section
4. You should see: **"✅ Piper"** (green badge)
5. Click any TTS button in the app - you should hear natural Polish speech!

## Troubleshooting

### "⚠️ Web Speech" shows instead of "✅ Piper"

**Possible causes:**

1. **Piper not installed**: Run `piper-tts --version` to check
2. **Voice models not downloaded**: Check that `.onnx` files exist in `public/voices/`
3. **Dev server not restarted**: Restart with `npm run dev`

### No sound when clicking TTS buttons

1. **Check system volume**: Make sure your speakers/headphones are working
2. **Check browser console**: Open DevTools (F12) and look for errors
3. **Test Piper directly**: Run the verification command above

### "Command not found: piper-tts"

Piper is not installed. Install it with:
```bash
yay -S piper-tts-bin
```

### Voice models not found

Make sure you're in the project root directory when downloading:
```bash
cd /home/wiirijo/Documents/Personal/Polish
mkdir -p public/voices
cd public/voices
# Then download the .onnx files
```

## Cache Management

Piper TTS caches generated audio files to speed up repeated playback.

- **View cache stats**: Go to Settings → TTS Backend section
- **Clear cache**: Click "Clear Cache" button (frees up disk space)
- **Cache location**: `public/audio-cache/`

## Additional Voice Models

Browse all available Piper voices:
- https://huggingface.co/rhasspy/piper-voices/tree/main/pl/pl_PL

You can download multiple voice models and the app will use the first one it finds.

## Performance

- **First playback**: ~100-300ms (generates audio)
- **Cached playback**: Instant (plays from cache)
- **Cache size**: ~50-100KB per phrase
- **Typical cache**: 10-50MB after extended use

## Comparison

| Feature | Piper TTS | Web Speech API |
|---------|-----------|----------------|
| Voice Quality | ⭐⭐⭐⭐⭐ Natural | ⭐⭐ Robotic |
| Speed | ⚡ Fast (cached) | ⚡ Fast |
| Offline | ✅ Yes | ✅ Yes |
| Setup | 🔧 Requires install | ✅ Built-in |
| Polish Support | ✅ Excellent | ⚠️ Limited |

## Support

If you encounter issues:

1. Check the browser console for errors (F12 → Console)
2. Check the terminal where `npm run dev` is running
3. Verify Piper installation: `piper-tts --version`
4. Test voice models: `ls -lh public/voices/`

## Fallback Behavior

The app automatically falls back to Web Speech API if:
- Piper is not installed
- Voice models are not found
- Piper encounters an error

This ensures TTS always works, even without Piper installed.
