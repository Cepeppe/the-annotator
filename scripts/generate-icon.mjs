// Generates build/icon.ico, a 256x256 32-bit BMP icon for electron-builder.
// Minimal design: navy background, white frame, a yellow "bbox" in the middle.
// Writing the file by hand avoids pulling in an image toolchain just for this.
//
// Run with: npm run icon:gen

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 256;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(REPO_ROOT, 'build', 'icon.ico');

// BGRA (a Windows BMP stores BGR plus alpha, little-endian).
const BG = { b: 0x91, g: 0x40, r: 0x1e, a: 0xff }; // navy
const BORDER = { b: 0xff, g: 0xff, r: 0xff, a: 0xff };
const BORDER_INNER = { b: 0xc7, g: 0xd2, r: 0xfe, a: 0xff }; // light blue
const BBOX_FILL = { b: 0x24, g: 0xbf, r: 0xfb, a: 0xff }; // yellow
const BBOX_BORDER = { b: 0x06, g: 0x95, r: 0xb4, a: 0xff }; // dark amber

function pixelAt(x, y) {
  // 8px white outer frame.
  if (x < 8 || y < 8 || x >= SIZE - 8 || y >= SIZE - 8) return BORDER;
  // 2px light blue inner frame.
  if (x < 12 || y < 12 || x >= SIZE - 12 || y >= SIZE - 12) return BORDER_INNER;
  // 120x90 box in the centre.
  const bbW = 120;
  const bbH = 90;
  const bbX0 = (SIZE - bbW) >> 1;
  const bbY0 = (SIZE - bbH) >> 1;
  const bbX1 = bbX0 + bbW;
  const bbY1 = bbY0 + bbH;
  if (x >= bbX0 && x < bbX1 && y >= bbY0 && y < bbY1) {
    // 4px box outline
    if (x < bbX0 + 4 || y < bbY0 + 4 || x >= bbX1 - 4 || y >= bbY1 - 4) return BBOX_BORDER;
    return BBOX_FILL;
  }
  return BG;
}

function buildBmpInIco() {
  // BITMAPINFOHEADER (40 bytes)
  // In an ICO the height is doubled (image + AND mask), while sizeImage only
  // covers the image data.
  const headerSize = 40;
  const imageBytes = SIZE * SIZE * 4;
  const maskBytes = (SIZE * SIZE) / 8; // 1 bit per pixel
  const buf = Buffer.alloc(headerSize + imageBytes + maskBytes);

  // BITMAPINFOHEADER
  buf.writeUInt32LE(headerSize, 0); // biSize
  buf.writeInt32LE(SIZE, 4); // biWidth
  buf.writeInt32LE(SIZE * 2, 8); // biHeight (doubled for ICO)
  buf.writeUInt16LE(1, 12); // biPlanes
  buf.writeUInt16LE(32, 14); // biBitCount
  buf.writeUInt32LE(0, 16); // biCompression = BI_RGB
  buf.writeUInt32LE(imageBytes, 20); // biSizeImage
  // The remaining header fields stay zero.

  // Pixel data BGRA, bottom-up
  let off = headerSize;
  for (let y = SIZE - 1; y >= 0; y--) {
    for (let x = 0; x < SIZE; x++) {
      const p = pixelAt(x, y);
      buf[off++] = p.b;
      buf[off++] = p.g;
      buf[off++] = p.r;
      buf[off++] = p.a;
    }
  }
  // AND mask: all zero means fully opaque.
  buf.fill(0x00, headerSize + imageBytes);

  return buf;
}

function buildIco() {
  const bmp = buildBmpInIco();
  // ICONDIR (6) + ICONDIRENTRY (16) + BMP
  const ico = Buffer.alloc(6 + 16 + bmp.length);
  // ICONDIR
  ico.writeUInt16LE(0, 0); // reserved
  ico.writeUInt16LE(1, 2); // type = 1 (icon)
  ico.writeUInt16LE(1, 4); // count = 1
  // ICONDIRENTRY
  ico.writeUInt8(0, 6); // width (0 = 256)
  ico.writeUInt8(0, 7); // height (0 = 256)
  ico.writeUInt8(0, 8); // colorCount
  ico.writeUInt8(0, 9); // reserved
  ico.writeUInt16LE(1, 10); // planes
  ico.writeUInt16LE(32, 12); // bitCount
  ico.writeUInt32LE(bmp.length, 14); // bytesInRes
  ico.writeUInt32LE(22, 18); // imageOffset
  bmp.copy(ico, 22);
  return ico;
}

function main() {
  const dir = dirname(OUT);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ico = buildIco();
  writeFileSync(OUT, ico);
  console.log(`OK: ${OUT} (${ico.length} bytes)`);
}

main();
