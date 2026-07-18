// Generates branded NSIS installer images (sidebar + header) from the app icon.
// Run: node apps/desktop/scripts/gen-installer-art.mjs
import { Jimp, loadFont, rgbaToInt, HorizontalAlign } from 'jimp';
import { SANS_32_WHITE, SANS_16_WHITE } from 'jimp/fonts';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const build = resolve(__dirname, '../build');
const BG = rgbaToInt(20, 20, 26, 255); // Kotrain dark #14141a
const ACCENT = rgbaToInt(109, 94, 252, 255); // #6d5efc

const icon = await Jimp.read(resolve(build, 'icon.png'));
const f32 = await loadFont(SANS_32_WHITE);
const f16 = await loadFont(SANS_16_WHITE);
const f14 = await loadFont(SANS_16_WHITE);

// --- Welcome/finish sidebar: 164 x 314 ---
const side = new Jimp({ width: 164, height: 314, color: BG });
// subtle accent bar down the left edge
for (let y = 0; y < 314; y++) for (let x = 0; x < 3; x++) side.setPixelColor(ACCENT, x, y);
const paw = icon.clone().resize({ w: 112, h: 112 });
side.composite(paw, (164 - 112) / 2, 30);
side.print({ font: f32, x: 0, y: 158, text: { text: 'Kotrain', alignmentX: HorizontalAlign.CENTER }, maxWidth: 164 });
side.print({
  font: f16,
  x: 8,
  y: 206,
  text: { text: 'Local-first AI\ncoding & cowork', alignmentX: HorizontalAlign.CENTER },
  maxWidth: 148,
});
await side.write(resolve(build, 'installerSidebar.bmp'));

// --- Inner-page header: 150 x 57 ---
const header = new Jimp({ width: 150, height: 57, color: BG });
const smallPaw = icon.clone().resize({ w: 40, h: 40 });
header.composite(smallPaw, 8, 8);
header.print({ font: f14, x: 54, y: 18, text: 'Kotrain' });
await header.write(resolve(build, 'installerHeader.bmp'));

console.log('wrote installerSidebar.bmp (164x314) + installerHeader.bmp (150x57)');
