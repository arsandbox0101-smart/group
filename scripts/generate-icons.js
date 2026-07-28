import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMinimalPng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  
  const ihdrChunk = makeChunk('IHDR', ihdr);
  
  const rawData = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    rawData[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      const distFromCenter = Math.sqrt(Math.pow(x - width/2, 2) + Math.pow(y - height/2, 2));
      const maxDist = Math.sqrt(Math.pow(width/2, 2) + Math.pow(height/2, 2));
      const factor = 1 - (distFromCenter / maxDist) * 0.4;
      
      rawData[pixelStart] = Math.min(255, Math.max(0, Math.floor(r * factor)));
      rawData[pixelStart + 1] = Math.min(255, Math.max(0, Math.floor(g * factor)));
      rawData[pixelStart + 2] = Math.min(255, Math.max(0, Math.floor(b * factor)));
    }
  }
  
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4);
  data.copy(buf, 8);
  
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const png192 = createMinimalPng(192, 192, 37, 99, 235);
const png512 = createMinimalPng(512, 512, 37, 99, 235);

fs.writeFileSync(path.join(publicDir, 'pwa-192.png'), png192);
fs.writeFileSync(path.join(publicDir, 'pwa-512.png'), png512);

console.log('✅ Generated PWA icons successfully in /public');
