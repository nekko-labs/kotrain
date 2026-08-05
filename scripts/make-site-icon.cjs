/**
 * Regenerates the marketing site's icon from the same vector source as the app
 * icon, so the site can never drift back to a different mark.
 *
 *   node scripts/make-site-icon.cjs
 *
 * Writes apps/website/favicon.svg, which the site uses both as its favicon and
 * as the nav/footer brand mark. The small-size variant of the art is the one
 * that survives 16px: no stars, a heavier trail, a bigger comet head.
 */
const { writeFileSync } = require('fs');
const { join } = require('path');
const { iconSvg } = require('../apps/desktop/scripts/icon-art.cjs');

const OUT = join(__dirname, '..', 'apps', 'website', 'favicon.svg');

// Drawn for 32px, but with no width/height so CSS decides the rendered size:
// one file serves the 16px tab icon and the 22px nav mark.
writeFileSync(OUT, iconSvg(32).replace(/ width="\d+" height="\d+"/, ''));
console.log('wrote apps/website/favicon.svg');
