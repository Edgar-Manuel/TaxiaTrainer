/**
 * Generates the PWA icons (taxi checker design) as PNGs without any
 * image dependency: raw RGBA pixels + zlib + hand-built PNG chunks.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const AMBER = [251, 191, 36];
const BLACK = [24, 24, 27];
const WHITE = [255, 255, 255];

function drawIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : Math.round(size * 0.2);
  const checker = Math.round(size / 8);
  const stripTop = Math.round(size * 0.375);
  const stripBottom = stripTop + checker * 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded corners (transparent outside).
      if (radius > 0) {
        const cx = x < radius ? radius : x >= size - radius ? size - radius - 1 : x;
        const cy = y < radius ? radius : y >= size - radius ? size - radius - 1 : y;
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
      }
      let color = AMBER;
      if (y >= stripTop && y < stripBottom) {
        const col = Math.floor(x / checker);
        const row = Math.floor((y - stripTop) / checker);
        color = (col + row) % 2 === 0 ? BLACK : WHITE;
      }
      const offset = (y * size + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, drawIcon(size, false));
  writeFileSync(`public/icons/icon-maskable-${size}.png`, drawIcon(size, true));
}
console.log("✅ Iconos generados en public/icons/");
