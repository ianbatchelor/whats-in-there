# Explainer video

A 71-second, 1920×1080 explainer clip for See What's in Here, drawn in code so it can be edited and re-rendered.

- `index.html`: the whole video as one page. `renderAt(t)` draws the frame at `t` seconds; the scene times are in `T` and in each scene function. Uses the app's colours, fonts, brand mark and the place photos in `public/places/`.
- `music.py`: the soundtrack (music bed plus tap, shutter, chime and typing sounds timed to the picture). Needs Python 3 with numpy.
- `render.mjs`: records the page frame by frame with Playwright and encodes it with ffmpeg.

## Scenes

| Time | Scene |
| --- | --- |
| 0–7 s | Hook: "What's in the freezer / attic / shed / wardrobe?", then "Bought pasta again?" |
| 7–11 s | Logo and "Know what you've got, wherever you keep it." |
| 11–18 s | 1 Tap: phone taps the sticker on the freezer, the place opens |
| 18–26 s | 2 Snap: scan a pack of peas, the form fills itself in, Add |
| 26–32 s | 3 Share: the new item appears on a second phone, live |
| 32–38 s | 4 Use: the Use first list |
| 38–43.5 s | 5 Find: all places, search "tent", found in the attic |
| 43.5–50 s | 6 Lists: the Lists tab, a new "Christmas dinner" list shared with family |
| 50–58.5 s | 7 Presents: Mia's wish list, paste a link, "I'm getting this", and Mia's own view without it |
| 58.5–65 s | 8 Christmas: who's getting what, lists for the day, decorations, room in the freezer |
| 65–70.6 s | End card: "Tap. Snap. Sorted." and seewhatsinhere.com |

## Render

```bash
cd marketing/explainer
python3 music.py music.wav
node render.mjs explainer.mp4 music.wav        # about 2 minutes
node render.mjs --stills . 14.4 23.4 41.5      # PNG stills, for checking a moment
```

Fonts load from Google Fonts, so rendering needs a network connection.

The app's How it works page (`/how-it-works/`) plays a smaller copy at `public/video/how-it-works.mp4`. After changing the video, make that copy again and update the chapter times in `lib/domain/howItWorks.ts`:

```bash
ffmpeg -i explainer.mp4 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart ../../public/video/how-it-works.mp4
```
