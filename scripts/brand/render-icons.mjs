// Draws the iOS app icon (1024px, no transparency) and launch screen (2732px) from the brand mark in
// components/brand/BrandMark.tsx. Run: node scripts/brand/render-icons.mjs, then copy icon.png and splash.png
// into ios/App/App/Assets.xcassets (AppIcon-512@2x.png and the three splash files).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // the copy installed with the browser
const mark = (stroke, fillOpacity) => `
  <path d="M32 6v7M17 10l3.5 6M47 10l-3.5 6M9 21l6 3M55 21l-6 3" stroke="${stroke}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14 30 32 23l18 7-18 7z" fill="${stroke}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14 30v17l18 8 18-8V30M32 37v18" stroke="${stroke}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const icon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#22543f"/><stop offset="1" stop-color="#132f25"/></radialGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="40%"><stop offset="0" stop-color="#f6c65b" stop-opacity="0.22"/><stop offset="1" stop-color="#f6c65b" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g transform="translate(176 150) scale(10.5)">${mark('#f6c65b', 0.22)}</g>
</svg>`;
const splash = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#183f32"/>
  <g transform="translate(1046 1030) scale(10)">${mark('#f6c65b', 0.22)}</g>
</svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  for (const [name, svg, w] of [['icon.png', icon(1024), 1024], ['splash.png', splash(2732), 2732]]) {
    await p.setViewportSize({ width: w, height: w });
    await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await p.screenshot({ path: name, omitBackground: false });
  }
  await b.close();
})();
