// Records index.html to an MP4, one exact frame at a time.
// node render.mjs <out.mp4> [music.wav]        full video
// node render.mjs --stills <dir> 3.2 14.5 ...   PNG stills at given seconds
// Add --page christmas.html (first) to record another page; its size comes from window.SIZE.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright'); // the copy installed with the browser
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
(async () => {
  let args = process.argv.slice(2), file = 'index.html';
  if (args[0] === '--page') { file = args[1]; args = args.slice(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, file));
  const size = await page.evaluate(() => window.SIZE || { w: 1920, h: 1080 });
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  if (args[0] === '--stills') {
    const dir = args[1];
    for (const t of args.slice(2)) {
      await page.evaluate((t) => window.renderAt(t), Number(t));
      await page.screenshot({ path: path.join(dir, `t${t}.png`) });
    }
    await browser.close(); return;
  }
  const out = args[0], wav = args[1];
  const dur = await page.evaluate(() => window.DURATION);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(wav ? ['-i', wav] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    ...(wav ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(dur * FPS);
  for (let f = 0; f < n; f++) {
    await page.evaluate((t) => window.renderAt(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${n}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
})();
