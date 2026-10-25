# StudySync AI: introduction video

A 59-second, 1920×1080 intro to StudySync, made in code with
[Remotion](https://www.remotion.dev) (React for video). It uses real
screenshots of the app and Yuuki's own art. The video has no sound; add music
or a voice-over in any video editor.

```
out/studysync-intro.mp4      the finished video
src/index.jsx                the timeline: title, hello, tour, phones, closing
src/tour.js                  the guided tour: pages, clicks, what gets pointed at, and when
src/Tour.jsx                 the app window, camera, annotations, cursor, side panel
src/Scenes.jsx               the other scenes
public/shots/                screenshots + shots.json (sizes and element positions)
public/yuuki/, public/brand/ Yuuki's poses and the logo, copied from the app
```

## Make it again

```bash
npm install
```

1. Start the app in sandbox mode (from the project root): `npm run dev -- --sandbox`.
2. Retake the screenshots with a sandbox account. The script refuses to run against the normal server, and it re-seeds the sandbox with a demo semester dated from today:
   ```bash
   SHOT_USER=<user> SHOT_PASS=<password> npm run shots
   ```
3. Preview and tweak it live: `npm run studio`.
4. Render: `npm run render`. Remotion uses the Chrome installed on this computer (see `remotion.config.js`).

To check a few frames without a full render: `node scripts/stills.mjs 300 900 1500` (written to `out/stills/`).

## Changing it

- Wording, timing and where the camera zooms are all in `src/tour.js`. Frames are at 30 per second.
- Boxes are in the screenshot's CSS pixels (`[x, y, width, height]`). `public/shots/shots.json` lists the ones the script found.
- Colours and fonts are in `src/theme.js`; they match the app.

Remotion is free for individuals and companies of up to three people; see its license.
