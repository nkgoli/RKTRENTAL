import { deflateSync } from 'node:zlib';

type RGB = [number, number, number];
const WIDTH = 320;
const HEIGHT = 200;

/** Small original building illustration. No downloaded or third-party image data. */
export function buildingPng(variant: number): Uint8Array {
  const palette: RGB[] = [[78, 119, 157], [155, 92, 75], [118, 128, 90], [131, 102, 147], [189, 139, 76], [75, 143, 137], [146, 103, 110], [103, 119, 156]];
  const wall = palette[variant % palette.length]!;
  const pixels = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  const paint = (x: number, y: number, color: RGB) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const offset = y * (1 + WIDTH * 3) + 1 + x * 3;
    pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
  };
  const rect = (x: number, y: number, width: number, height: number, color: RGB) => {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) paint(xx, yy, color);
  };
  for (let y = 0; y < HEIGHT; y++) {
    const sky: RGB = [Math.round(170 + y * 0.12), Math.round(207 + y * 0.05), 232];
    rect(0, y, WIDTH, 1, y < 164 ? sky : [98, 143, 103]);
  }
  const height = 91 + (variant % 4) * 13;
  const left = 55 + (variant % 3) * 9;
  const top = 161 - height;
  rect(left - 5, top + 5, 220, height, [58, 71, 77]);
  rect(left, top, 210, height, wall);
  for (let y = top - 21; y < top; y++) {
    const edge = Math.round((top - y) * 0.72);
    rect(left - edge, y, 210 + edge * 2, 1, [69, 74, 81]);
  }
  for (let row = 0; row < (height > 110 ? 3 : 2); row++) {
    for (let column = 0; column < 4; column++) {
      const x = left + 18 + column * 49;
      const y = top + 16 + row * 34;
      rect(x - 2, y - 2, 29, 24, [55, 68, 72]);
      rect(x, y, 25, 20, [207, 226, 222]);
      rect(x + 11, y, 3, 20, [71, 89, 95]);
      rect(x, y + 9, 25, 2, [71, 89, 95]);
    }
  }
  rect(left + 91, 126, 32, 36, [64, 75, 78]);
  rect(0, 164, WIDTH, 5, [75, 106, 78]);
  rect(0, 184, WIDTH, 16, [112, 117, 111]);

  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const chunk = (name: string, body: Buffer) => {
    const joined = Buffer.concat([Buffer.from(name), body]);
    let crc = 0xffffffff;
    for (const byte of joined) crc = table[(crc ^ byte) & 255]! ^ (crc >>> 8);
    const output = Buffer.alloc(body.length + 12);
    output.writeUInt32BE(body.length, 0);
    output.write(name, 4);
    body.copy(output, 8);
    output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, output.length - 4);
    return output;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 2;
  return new Uint8Array(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}
