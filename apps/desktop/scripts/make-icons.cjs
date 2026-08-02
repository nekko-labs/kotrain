/**
 * Regenerates the app icons from the vector source in this file.
 *
 *   npx electron apps/desktop/scripts/make-icons.cjs
 *
 * Electron is the rasterizer (it is already a devDependency, and it is the same
 * renderer that will draw the app), so there is no new native/image toolchain to
 * install. Each size is drawn at its own size rather than downscaled from one
 * big render: below 48px the art drops the stars and thickens the strokes, which
 * is the difference between a readable taskbar icon and a smudge.
 *
 * Writes build/icon.svg (512 reference), build/icon.png (512, what
 * electron-builder uses for mac/linux) and build/icon.ico (Windows, PNG-encoded
 * entries at every size Explorer asks for).
 */
const { app, BrowserWindow, nativeImage } = require('electron');
const { writeFileSync } = require('fs');
const { join } = require('path');

const BUILD = join(__dirname, '..', 'build');
const PUBLIC = join(__dirname, '..', 'src', 'renderer', 'public');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

/* ── the mark ─────────────────────────────────────────────────────────────── */

const C = 256; // centre of the 512 viewBox
const RX = 158;
const RY = 100;
/** What the trail fades into: roughly the sky behind its tail. */
const SKY = '#101020';
const TILT = -26; // degrees; enough to read as depth, not as a flat ring
/** Where the body sits on the orbit, in ellipse parameter degrees. */
const HEAD_T = -52;
/** How far back the trail reaches from the head. */
const TAIL_SWEEP = 300;

/** Point at parameter `t` (degrees) on the tilted orbit. */
function onOrbit(t) {
  const a = (t * Math.PI) / 180;
  const x = RX * Math.cos(a);
  const y = RY * Math.sin(a);
  const r = (TILT * Math.PI) / 180;
  return [C + x * Math.cos(r) - y * Math.sin(r), C + x * Math.sin(r) + y * Math.cos(r)];
}

const lerp = (a, b, t) => a + (b - a) * t;
/** Blend two #rrggbb colours. */
function mix(c1, c2, t) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(c1);
  const [r2, g2, b2] = p(c2);
  const h = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(lerp(r1, r2, t))}${h(lerp(g1, g2, t))}${h(lerp(b1, b2, t))}`;
}

/**
 * The comet's trail, as one tapered ribbon: sample the orbit, offset each sample
 * along its normal by a half-width that grows toward the head, and close the two
 * sides into a single filled path.
 *
 * Drawing it as a run of stroked segments instead (the obvious approach) beads
 * visibly, because every semi-transparent round cap double-composites over its
 * neighbour. One path with one gradient has no seams to show.
 */
function trail(samples, headWidth) {
  // Edge points of the ribbon at each sample, plus the colour that band should
  // end up. The fade has to follow arc length, not a straight gradient axis: the
  // trail wraps 300 degrees, so its tail ends up spatially next to its head and
  // any linear gradient collapses to a sliver of violet.
  const edge = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const deg = HEAD_T - TAIL_SWEEP * (1 - t);
    const [x, y] = onOrbit(deg);
    // Tangent by finite difference, so the normal follows the tilted ellipse.
    const [ax, ay] = onOrbit(deg - 0.6);
    const [bx, by] = onOrbit(deg + 0.6);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    // Width flares late, so the tail stays a thin filament for most of its run.
    const half = (headWidth / 2) * lerp(0.06, 1, Math.pow(t, 1.9));
    edge.push({
      l: [x + nx * half, y + ny * half],
      r: [x - nx * half, y - ny * half],
      // Opaque fill, faded by mixing toward the sky rather than by alpha: two
      // adjacent translucent bands would double-composite into a visible seam.
      fill: mix(SKY, mix('#6d5efc', '#22d3ee', Math.pow(t, 1.3)), lerp(0.05, 1, Math.pow(t, 0.85))),
    });
  }
  const p = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  // Each band spans two samples, so it overlaps its neighbour and no
  // antialiased hairline can show through between them. Painted tail first, so
  // the brighter band always lands on top of the dimmer one it overlaps.
  const bands = [];
  for (let i = 0; i < samples; i++) {
    const a = edge[i];
    const b = edge[Math.min(samples, i + 2)];
    bands.push(`<path d="M${p(a.l)}L${p(b.l)}L${p(b.r)}L${p(a.r)}Z" fill="${edge[i + 1].fill}"/>`);
  }
  // A round cap where the ribbon meets the body.
  const last = edge[samples];
  bands.push(
    `<circle cx="${((last.l[0] + last.r[0]) / 2).toFixed(1)}" cy="${((last.l[1] + last.r[1]) / 2).toFixed(1)}" ` +
      `r="${(headWidth / 2).toFixed(1)}" fill="${last.fill}"/>`,
  );
  return bands.join('\n      ');
}

/**
 * The Nekkos mark: an orbit. A comet of light running a tilted ring, violet
 * into cyan (the brand gradient), over deep space. Abstract on purpose: one
 * sweeping arc plus one bright body reads at 16px, where the mascot cannot.
 *
 * Everything is expressed in a 512 viewBox and scaled by the renderer, so the
 * only size-dependent decisions are how much detail survives.
 */
function iconSvg(size, px = size) {
  const detail = size >= 48;
  const tiny = size < 32;
  // Small icons need a heavier stroke and a bigger head, or they read as a smudge.
  const width = tiny ? 44 : detail ? 30 : 38;
  const head = tiny ? 46 : detail ? 38 : 42;
  const samples = detail ? 180 : 60;
  const corner = 114; // 22.3% of 512, the platform squircle radius
  const [hx, hy] = onOrbit(HEAD_T);

  const stars = [
    [96, 108, 3.2, 0.85], [150, 62, 2.1, 0.5], [420, 92, 3.4, 0.85], [452, 186, 2.2, 0.45],
    [70, 250, 2.4, 0.55], [446, 336, 2.6, 0.6], [120, 400, 3.0, 0.7], [330, 460, 2.2, 0.45],
    [232, 60, 2.0, 0.4], [60, 350, 1.9, 0.35], [268, 466, 2.0, 0.4], [176, 452, 2.4, 0.5],
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="space" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#221f45"/>
      <stop offset="0.5" stop-color="#121222"/>
      <stop offset="1" stop-color="#090911"/>
    </linearGradient>
    <radialGradient id="nebula" cx="0.3" cy="0.26" r="0.72">
      <stop offset="0" stop-color="#6d5efc" stop-opacity="0.42"/>
      <stop offset="0.5" stop-color="#4c46c8" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#6d5efc" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nebula2" cx="0.76" cy="0.82" r="0.55">
      <stop offset="0" stop-color="#22d3ee" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloom" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#a9f3ff" stop-opacity="0.85"/>
      <stop offset="0.45" stop-color="#22d3ee" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="core" cx="0.5" cy="0.46" r="0.5">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#e6fbff"/>
      <stop offset="1" stop-color="#7de6ff"/>
    </radialGradient>
    <clipPath id="squircle">
      <rect x="0" y="0" width="512" height="512" rx="${corner}" ry="${corner}"/>
    </clipPath>
  </defs>

  <g clip-path="url(#squircle)">
    <rect width="512" height="512" fill="url(#space)"/>
    <rect width="512" height="512" fill="url(#nebula)"/>
    <rect width="512" height="512" fill="url(#nebula2)"/>
    ${detail ? stars.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${o}"/>`).join('\n    ') : ''}

    <!-- No closed ring behind the trail: at icon scale a second stroke reads as
         a competing shape. The arc sweeps nearly a full lap, which is enough to
         say "orbit" on its own. -->
    <g fill="none">
      ${trail(samples, width)}
    </g>

    <!-- The body: a hot white core inside a cyan bloom. -->
    <circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${(head * 2.1).toFixed(1)}" fill="url(#bloom)"/>
    <circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${(head * 0.62).toFixed(1)}" fill="url(#core)"/>
  </g>

  <!-- Rim light. A dark tile on a dark taskbar loses its own edge; a hairline of
       the accent gives it back without lightening the art. -->
  <rect x="3" y="3" width="506" height="506" rx="${corner - 3}" ry="${corner - 3}"
        fill="none" stroke="#8b7dff" stroke-opacity="0.22" stroke-width="${size >= 48 ? 6 : 10}"/>
</svg>`;
}

/* ── the NSIS installer art ───────────────────────────────────────────────── */

/**
 * The Windows installer's header strip and sidebar panel. Same deep space, same
 * mark, and the product's actual name: these two were still shipping the
 * pre-rebrand "Open Paw" wordmark and the orange cat.
 *
 * `bare` drops the squircle and the background so the mark can sit on the
 * panel's own space instead of on a rounded tile inside it.
 */
function bannerSvg(w, h, opts, pw = w, ph = h) {
  const { markSize, markX, markY, title, tagline, titleSize, layout } = opts;
  const inner = iconSvg(512)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  const column = layout === 'column';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="${column ? 0.6 : 1}" y2="1">
      <stop offset="0" stop-color="#141428"/>
      <stop offset="0.6" stop-color="#0c0c16"/>
      <stop offset="1" stop-color="#07070d"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#panel)"/>
  <g transform="translate(${markX} ${markY}) scale(${markSize / 512})">${inner}</g>
  <text x="${column ? w / 2 : markX + markSize + 14}" y="${column ? markY + markSize + 46 : h / 2 + titleSize * 0.36}"
        text-anchor="${column ? 'middle' : 'start'}" fill="#f2f1fa"
        font-family="Segoe UI, system-ui, sans-serif" font-size="${titleSize}" font-weight="600"
        letter-spacing="${(titleSize * 0.06).toFixed(2)}">${title}</text>
  ${tagline
      ? `<text x="${w / 2}" y="${markY + markSize + 76}" text-anchor="middle" fill="#9a98ad"
        font-family="Segoe UI, system-ui, sans-serif" font-size="13">${tagline}</text>`
      : ''}
</svg>`;
}

/**
 * Draw `svg` at `w`x`h` CSS pixels and return exactly that many device pixels.
 *
 * Two traps here. capturePage honours the display's scale factor, so on a 125%
 * monitor a 512px window yields a 640px bitmap, and an .ico whose directory
 * claims 16px while holding a 20px image is malformed. And Windows refuses to
 * make a window as small as a 16px icon. Both are solved by drawing large and
 * resizing down, which also supersamples the curve for free.
 */
async function shoot(win, svgFor, w, h) {
  const scale = Math.max(1, Math.ceil(256 / Math.max(w, h)), 2);
  const rw = Math.round(w * scale);
  const rh = Math.round(h * scale);
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}
svg{display:block}</style>${svgFor(rw, rh)}`;
  win.setBounds({ x: 0, y: 0, width: rw, height: rh });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  // One frame after load, so gradients are painted before the capture.
  await new Promise((r) => setTimeout(r, 120));
  const shot = await win.capturePage({ x: 0, y: 0, width: rw, height: rh });
  return shot.getSize().width === w && shot.getSize().height === h
    ? shot
    : shot.resize({ width: w, height: h, quality: 'best' });
}

async function render(win, size) {
  // The art is chosen for the final size; only the raster is supersampled.
  return (await shoot(win, (rw) => iconSvg(size, rw), size, size)).toPNG();
}

/** Encode a nativeImage as an uncompressed 24-bit BMP, which is all NSIS reads. */
function toBmp24(image) {
  const { width, height } = image.getSize();
  const rgba = image.toBitmap(); // BGRA, top-down
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixels = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    // BMP rows run bottom-up.
    const src = (height - 1 - y) * width * 4;
    let at = y * rowSize;
    for (let x = 0; x < width; x++) {
      pixels[at++] = rgba[src + x * 4 + 0]; // B
      pixels[at++] = rgba[src + x * 4 + 1]; // G
      pixels[at++] = rgba[src + x * 4 + 2]; // R
    }
  }
  const header = Buffer.alloc(54);
  header.write('BM', 0);
  header.writeUInt32LE(54 + pixels.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14); // DIB header size
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26); // planes
  header.writeUInt16LE(24, 28); // bpp
  header.writeUInt32LE(pixels.length, 34);
  header.writeInt32LE(2835, 38); // 72 DPI
  header.writeInt32LE(2835, 42);
  return Buffer.concat([header, pixels]);
}

/** Pack PNG buffers into an .ico (PNG-compressed entries, Vista+). */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, at + 0); // 0 means 256
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1);
    dir.writeUInt8(0, at + 2); // palette
    dir.writeUInt8(0, at + 3); // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: false, backgroundThrottling: false },
  });

  writeFileSync(join(BUILD, 'icon.svg'), iconSvg(512));

  win.setBounds({ x: 0, y: 0, width: 512, height: 512 });
  writeFileSync(join(BUILD, 'icon.png'), await render(win, 512));

  const entries = [];
  for (const size of SIZES) {
    win.setBounds({ x: 0, y: 0, width: size, height: size });
    entries.push({ size, png: await render(win, size) });
  }
  writeFileSync(join(BUILD, 'icon.ico'), buildIco(entries));

  // The web/PWA edition's icon (also the apple-touch-icon) is the same art.
  writeFileSync(join(PUBLIC, 'icon-512.png'), await render(win, 512));

  // NSIS art. Sizes are fixed by the installer: 150x57 header, 164x314 sidebar.
  const header = await shoot(
    win,
    (pw, ph) => bannerSvg(150, 57, { markSize: 40, markX: 10, markY: 8, title: 'Nekkos', titleSize: 19, layout: 'row' }, pw, ph),
    150,
    57,
  );
  writeFileSync(join(BUILD, 'installerHeader.bmp'), toBmp24(header));
  const sidebar = await shoot(
    win,
    (pw, ph) =>
      bannerSvg(
        164,
        314,
        { markSize: 88, markX: 38, markY: 62, title: 'Nekkos', tagline: 'Local-first AI coding', titleSize: 26, layout: 'column' },
        pw,
        ph,
      ),
    164,
    314,
  );
  writeFileSync(join(BUILD, 'installerSidebar.bmp'), toBmp24(sidebar));

  console.log(
    `wrote icon.svg, icon.png (512), icon.ico (${SIZES.join(', ')}), renderer icon-512.png, and the two installer BMPs`,
  );
  win.destroy();
  app.quit();
});
