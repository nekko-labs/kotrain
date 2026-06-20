// Generates branded NSIS installer images (sidebar + header) from the app icon.
// Run: node apps/desktop/scripts/gen-installer-art.mjs
import Jimp from 'jimp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const build = resolve(__dirname, '../build');
const BG = Jimp.rgbaToInt(20, 20, 26, 255); // Open Paw dark #14141a
const ACCENT = Jimp.rgbaToInt(255, 122, 89, 255); // #ff7a59

const icon = await Jimp.read(resolve(build, 'icon.png'));
const f32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
const f16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
const f14 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

// --- Welcome/finish sidebar: 164 x 314 ---
const side = new Jimp(164, 314, BG);
// subtle accent bar down the left edge
for (let y = 0; y < 314; y++) for (let x = 0; x < 3; x++) side.setPixelColor(ACCENT, x, y);
const paw = icon.clone().resize(112, 112);
side.composite(paw, (164 - 112) / 2, 30);
side.print(f32, 0, 158, { text: 'Open Paw', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 164);
side.print(f16, 8, 206, { text: 'Local-first AI\ncoding & cowork', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 148);
await side.writeAsync(resolve(build, 'installerSidebar.bmp'));

// --- Inner-page header: 150 x 57 ---
const header = new Jimp(150, 57, BG);
const smallPaw = icon.clone().resize(40, 40);
header.composite(smallPaw, 8, 8);
header.print(f14, 54, 18, 'Open Paw');
await header.writeAsync(resolve(build, 'installerHeader.bmp'));

console.log('wrote installerSidebar.bmp (164x314) + installerHeader.bmp (150x57)');
