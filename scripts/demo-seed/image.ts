import { deflateSync } from 'node:zlib';

type RGB = [number, number, number];
export type CardKind = 'property' | 'unit' | 'repair';
const WIDTH = 320;
const HEIGHT = 200;
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(name: string, body: Buffer) {
  const joined = Buffer.concat([Buffer.from(name), body]);
  let crc = 0xffffffff;
  for (const byte of joined) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  const output = Buffer.alloc(body.length + 12);
  output.writeUInt32BE(body.length, 0);
  output.write(name, 4);
  body.copy(output, 8);
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, output.length - 4);
  return output;
}
/** Deterministic original placeholder card; no downloaded artwork. The caption lives in the app, not the pixels. */
export function cardPng(kind: CardKind, label: string, seed: number): Uint8Array {
  const palettes: [RGB, RGB][] = [
    [[39, 96, 130], [96, 166, 174]], [[126, 81, 102], [198, 137, 139]],
    [[64, 105, 91], [143, 175, 132]], [[103, 86, 143], [161, 143, 193]],
    [[137, 91, 53], [211, 160, 101]], [[56, 104, 121], [132, 172, 198]],
  ];
  const [top, bottom] = palettes[(seed >>> 0) % palettes.length]!;
  const pixels = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  let noise = (seed ^ 0x9e3779b9 ^ [...label].reduce((h, ch) => Math.imul(h, 31) + ch.charCodeAt(0), 7)) >>> 0;
  // Artwork sits in the vertical middle of the card.
  const dy = 18;
  const paint = (x: number, y: number, color: RGB) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const offset = y * (1 + WIDTH * 3) + 1 + x * 3;
    pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
  };
  const rect = (x: number, y: number, width: number, height: number, color: RGB) => {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) paint(xx, yy + dy, color);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color: RGB, width = 3) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) {
      rect(Math.round(x1 + (x2 - x1) * i / (steps || 1)),
        Math.round(y1 + (y2 - y1) * i / (steps || 1)), width, width, color);
    }
  };
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    const grain = (noise >>> 29) - 4;
    const ratio = y / HEIGHT;
    paint(x, y, [0, 1, 2].map((channel) => Math.max(0, Math.min(255,
      Math.round(top[channel]! * (1 - ratio) + bottom[channel]! * ratio) + grain))) as RGB);
  }
  const white: RGB = [244, 249, 247];
  const shadow: RGB = [29, 47, 57];
  if (kind === 'property') {
    line(113, 82, 160, 42, white, 6); line(160, 42, 207, 82, white, 6);
    line(122, 79, 122, 121, white, 6); line(198, 79, 198, 121, white, 6);
    line(122, 121, 198, 121, white, 6); rect(151, 94, 18, 29, white);
  } else if (kind === 'unit') {
    rect(118, 52, 84, 65, white); rect(125, 59, 70, 51, shadow);
    rect(146, 83, 29, 27, white); rect(172, 89, 5, 5, shadow);
  } else {
    line(130, 104, 184, 50, white, 10); line(124, 92, 142, 110, white, 8);
    line(181, 48, 198, 64, white, 8); line(187, 47, 201, 47, white, 5);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0); header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; header[9] = 2;
  return new Uint8Array(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(pixels, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}
