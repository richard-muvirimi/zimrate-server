/**
 * Rasterises public/favicon.svg into the PNG icons Safari and the manifests need.
 *
 * Safari ignores SVG for `apple-touch-icon` and ignores the manifest's `icons`
 * array entirely, so a Home Screen install without a PNG here gets a screenshot
 * of the page instead of the mark. Run it after changing favicon.svg:
 *
 *   npm run icons
 *
 * The PNGs are committed, so a normal build never needs @resvg/resvg-js.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../public/favicon.svg'), 'utf8');

/** The mark's own viewBox, from favicon.svg. */
const ART_WIDTH = 28;
const ART_HEIGHT = 32;
/** Share of the canvas the mark occupies, leaving a margin iOS's corner mask can eat. */
const ART_SCALE = 0.62;
/** Opaque, because iOS composites Home Screen icons on white and applies its own mask. */
const BACKGROUND = '#0B1017';
const ACCENT = '#0270D7';

/** The contents of favicon.svg without its outer <svg> element, so it can be re-wrapped. */
const artwork = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

function wrap(size, content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
    ${content}
</svg>`;
}

/** The site's icon: the brand mark, centred. */
function markContent(size) {
    const scale = (size * ART_SCALE) / ART_HEIGHT;
    const x = (size - ART_WIDTH * scale) / 2;
    const y = (size - ART_HEIGHT * scale) / 2;

    return `<g transform="translate(${x} ${y}) scale(${scale})">${artwork}</g>`;
}

/**
 * The calculator's icon.
 *
 * It is a separate installable app, so it has to be tellable apart from the site
 * on a Home Screen holding both. It keeps the brand mark — nudged up and left to
 * make room — and gains a keypad badge, rather than inventing a second logo.
 */
function badgedContent(size) {
    const scale = (size * ART_SCALE * 0.84) / ART_HEIGHT;
    const x = (size - ART_WIDTH * scale) / 2 - size * 0.06;
    const y = (size - ART_HEIGHT * scale) / 2 - size * 0.07;

    const b = size * 0.44;
    const bx = size - b - size * 0.07;
    const by = size - b - size * 0.07;

    // Two rows of three keys under the display.
    const keys = [0.52, 0.75]
        .flatMap((cy) => [0.28, 0.5, 0.72].map((cx) => [cx, cy]))
        .map(([cx, cy]) =>
            `<circle cx="${bx + b * cx}" cy="${by + b * cy}" r="${b * 0.06}" fill="#fff"/>`)
        .join('');

    return `<g transform="translate(${x} ${y}) scale(${scale})">${artwork}</g>
    <rect x="${bx}" y="${by}" width="${b}" height="${b}" rx="${b * 0.26}"
          fill="${ACCENT}" stroke="${BACKGROUND}" stroke-width="${size * 0.03}"/>
    <rect x="${bx + b * 0.22}" y="${by + b * 0.16}" width="${b * 0.56}" height="${b * 0.14}"
          rx="${b * 0.05}" fill="#fff" fill-opacity="0.92"/>
    ${keys}`;
}

/**
 * A maskable icon may be cropped to a circle 80% of the icon's width, and the
 * badge's outer corner sits about 0.61 of the canvas from the centre — well
 * outside that safe zone, so a launcher would clip it. Shrinking the whole
 * composition about the centre brings it inside; the flat background bleeds out
 * to fill whatever shape the launcher masks to.
 */
const MASK_SAFE_SCALE = 0.62;

function maskableContent(size) {
    const half = size / 2;
    return `<g transform="translate(${half} ${half}) scale(${MASK_SAFE_SCALE}) translate(${-half} ${-half})">${badgedContent(size)}</g>`;
}

function render(size, content, destination) {
    const png = new Resvg(wrap(size, content(size)), { fitTo: { mode: 'width', value: size } })
        .render()
        .asPng();

    const path = resolve(here, '..', destination);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, png);
    console.log(`${destination}  ${size}×${size}  ${(png.length / 1024).toFixed(1)}K`);
}

// 180 is the only size Safari asks for. 192 and 512 are the manifest sizes
// Android and Chrome use; the maskable one is separate because it needs its own
// safe-zone padding.
render(180, markContent, 'public/apple-touch-icon.png');
render(180, badgedContent, 'calculator/public/apple-touch-icon.png');
render(192, badgedContent, 'calculator/public/icon-192.png');
render(512, badgedContent, 'calculator/public/icon-512.png');
render(512, maskableContent, 'calculator/public/icon-512-maskable.png');
