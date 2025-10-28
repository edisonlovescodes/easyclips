# Easy Clips

Browser-based timeline editor built on Next.js 16, Turbopack, and FFmpeg.wasm. Everything runs client-side so creators can trim, stack, and export social clips without paying for bandwidth or watermark add-ons.

## Key Features

- **Premiere-style timeline** – Scrubbable playhead, vertical tabs for video/audio/captions, zoom levels down to 2 px/sec (up to a 2 hour canvas when fully zoomed out), markers, and draggable clips via `@dnd-kit`.
- **Aspect ratio control** – 16:9, 9:16, 1:1, and 4:3 presets. The preview surface resizes in real time as you apply Smart Crop or blurred background modes.
- **FFmpeg.wasm export** – Everything renders in-browser. Progress reporting is wired to Zustand so the export modal surfaces errors with actionable advice.
- **Whop-ready routing** – `/experiences/[experienceId]`, `/dashboard/[companyId]`, and `/discover` pages are already wired for the Whop proxy/deployment flow.

## Local Development

```bash
pnpm install
pnpm dev       # Runs through the Whop proxy for iframe embedding
```

> ℹ️ If you prefer `npm`, delete `pnpm-lock.yaml`, run `npm install`, and use `npm run dev`.

### Required Environment Variables

Copy `.env.development` to `.env.local` (ignored by git) and fill in the Whop keys issued for your app:

```bash
cp .env.development .env.local
```

The fields are already referenced by `/lib/whop-sdk.ts`.

## Timeline Controls

| Action | Shortcut / Control |
| --- | --- |
| Zoom in/out | `+` / `–` buttons in the header (auto-adjusted step size) |
| Pan | Horizontal scroll / trackpad swipe |
| Scrub playhead | Click the ruler or drag the accent handle (range: 0 – 2 hours when zoomed out) |
| Add marker | “Markers (n)” button while at the desired timestamp |
| Switch tracks | Video / Audio / Captions toggle in the timeline header |

The zoom label shows how many pixels represent one second so you can gauge precision quickly.

## Captions

Zustand already models caption cues (`lib/stores/editorStore.ts`). To auto-generate them you can layer in one of these free options:

1. **Web Speech API** (Chrome/Edge): Stream microphone or video audio frames via `AudioContext` into `SpeechRecognition`, then map the transcripts back to timestamps and call `addCaption`.
2. **Whisper.cpp WASM** (fully offline): Load a small `.bin` model (31–142 MB), decode audio with FFmpeg.wasm, and pass PCM buffers to Whisper for high-accuracy transcription. This keeps the “free to run” promise without server costs.

A simple placeholder helper can live in `lib/captions.ts`:

```ts
import { useEditorStore } from "@/lib/stores/editorStore";

export async function generateCaptionsFromAudio(file: File) {
  const { addCaption } = useEditorStore.getState();
  // 1. Decode audio with FFmpeg.wasm or Web Audio.
  // 2. Send PCM to your transcription engine (Web Speech API, Whisper.cpp, etc.).
  // 3. Map transcripts into caption objects and call addCaption().
}
```

You can trigger it from a toolbar button or background task once uploads finish.

## Export Notes

- Supported inputs: MP4/H.264 video and AAC/MP3 audio.
- Long clips (> 2 minutes) may require extra memory in FFmpeg.wasm; encourage users to keep clips tight.
- If exports fail with the generic message, prompt the user to reload and try a fresh MP4/H.264 input—many obscure codecs aren’t decoded in the browser yet.

## Deployment

1. Push to GitHub (`edisonlovescodes/easyclips` is already linked).
2. `npx vercel git connect https://github.com/<owner>/easyclips.git`
3. Configure the same Whop environment variables inside Vercel.
4. Subsequent pushes to `main` trigger automatic builds.

## Brand Palette

- Cream: `#FCF6F5`
- Dark: `#141212`
- Accent: `#FA4616`

Timeline markers, headers, and floating labels are styled with higher contrast variants of these colors to stay readable on light backgrounds.
