import { deflateSync } from 'node:zlib';

type RGB = [number, number, number];
export type CardKind = 'property' | 'unit' | 'repair';
const WIDTH = 320;
const HEIGHT = 200;
// Seven 5-bit rows per glyph; all artwork and lettering are generated locally.
const font: Record<string, string> = {
  A:'0e11111f111111', B:'1e11111e11111e', C:'0f10101010100f', D:'1e11111111111e',
  E:'1f10101e10101f', F:'1f10101e101010', G:'0f10101711110f', H:'1111111f111111',
  I:'1f04040404041f', J:'0702020212120c', K:'11121418141211', L:'1010101010101f',
  M:'111b1515111111', N:'11191515131111', O:'0e11111111110e', P:'1e11111e101010',
  Q:'0e11111115120d', R:'1e11111e141211', S:'0f10100e01011e', T:'1f040404040404',
  U:'1111111111110e', V:'11111111110a04', W:'1111111515150a', X:'11110a040a1111',
  Y:'11110a04040404', Z:'1f01020408101f', '0':'0e11131519110e',
  '1':'040c040404040e', '2':'0e11010204081f', '3':'1e01010e01011e',
  '4':'02060a121f0202', '5':'1f10101e01011e', '6':'0e10101e11110e',
  '7':'1f010204080808', '8':'0e11110e11110e', '9':'0e11110f01010e',
  ' ':'00000000000000',
};
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
function wrapLabel(label: string) {
  const lines: string[] = [''];
  for (const word of label.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)) {
    const last = lines.length - 1;
    if (lines[last] && lines[last]!.length + word.length + 1 > 23) lines.push(word);
    else lines[last] = lines[last] ? `${lines[last]} ${word}` : word;
  }
  return lines.slice(0, 2);
}

/** Deterministic original placeholder card; no downloaded artwork or fonts. */
export function cardPng(kind: CardKind, label: string, seed: number): Uint8Array {
  const palettes: [RGB, RGB][] = [
    [[39, 96, 130], [96, 166, 174]], [[126, 81, 102], [198, 137, 139]],
    [[64, 105, 91], [143, 175, 132]], [[103, 86, 143], [161, 143, 193]],
    [[137, 91, 53], [211, 160, 101]], [[56, 104, 121], [132, 172, 198]],
  ];
  const [top, bottom] = palettes[(seed >>> 0) % palettes.length]!;
  const pixels = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  let noise = (seed ^ 0x9e3779b9) >>> 0;
  const paint = (x: number, y: number, color: RGB) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const offset = y * (1 + WIDTH * 3) + 1 + x * 3;
    pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
  };
  const rect = (x: number, y: number, width: number, height: number, color: RGB) => {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) paint(xx, yy, color);
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
    const grain = (noise >>> 28) - 8;
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
  rect(0, 138, WIDTH, 62, shadow);
  for (const [row, text] of wrapLabel(label).entries()) {
    const x0 = Math.round((WIDTH - text.length * 12) / 2);
    for (const [position, character] of [...text].entries()) {
      const glyph = font[character] ?? font[' ']!;
      for (let y = 0; y < 7; y++) {
        const bits = Number.parseInt(glyph.slice(y * 2, y * 2 + 2), 16);
        for (let x = 0; x < 5; x++) if (bits & (1 << (4 - x))) {
          rect(x0 + position * 12 + x * 2, 151 + row * 20 + y * 2, 2, 2, white);
        }
      }
    }
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
