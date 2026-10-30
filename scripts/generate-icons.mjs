import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * High-quality minimal PNG generator in pure Node.js
 * Draws a rounded squircle, clock dial ring, hands, and accent dot
 */
function renderMinimalIconPng(size) {
  const width = size;
  const height = size;

  // Raw RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44; // outer squircle bound
  const cornerRadius = width * 0.22;

  // Helper distance to rounded rectangle
  function distToSquircle(x, y) {
    const dx = Math.max(Math.abs(x - cx) - (cx - cornerRadius), 0);
    const dy = Math.max(Math.abs(y - cy) - (cy - cornerRadius), 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  const dialRadius = width * 0.26;
  const dialThickness = Math.max(2, width * 0.035);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      const dSquircle = distToSquircle(x, y);

      if (dSquircle > cornerRadius + 0.5) {
        // Transparent outside squircle
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
        continue;
      }

      // Base gradient: Royal electric blue (#1d4ed8 to #2563eb)
      const gradFactor = (x + y) / (width + height);
      let r = Math.round(29 * (1 - gradFactor) + 37 * gradFactor);
      let g = Math.round(78 * (1 - gradFactor) + 99 * gradFactor);
      let b = Math.round(216 * (1 - gradFactor) + 235 * gradFactor);
      let a = 255;

      // Anti-aliased outer squircle border
      if (dSquircle > cornerRadius - 0.5) {
        const edgeAlpha = Math.max(0, Math.min(1, cornerRadius + 0.5 - dSquircle));
        a = Math.round(255 * edgeAlpha);
      }

      // Distance from center
      const dxCenter = x - cx;
      const dyCenter = y - cy;
      const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);

      // 1. Clock dial ring (r ≈ dialRadius)
      const distFromRing = Math.abs(distCenter - dialRadius);
      if (distFromRing < dialThickness) {
        const angle = Math.atan2(dyCenter, dxCenter); // -PI to PI
        // Angle check: let arc sweep from -PI/2 (top) around to PI (left)
        const isDrawnArc = angle > -Math.PI / 2 || angle < -Math.PI * 0.9 || distFromRing < dialThickness * 0.5;
        if (isDrawnArc) {
          const ringAlpha = Math.max(0, 1 - distFromRing / dialThickness);
          r = Math.round(r * (1 - ringAlpha) + 255 * ringAlpha);
          g = Math.round(g * (1 - ringAlpha) + 255 * ringAlpha);
          b = Math.round(b * (1 - ringAlpha) + 255 * ringAlpha);
        }
      }

      // 2. Hour hand: pointing up (x ≈ cx, y between cy - dialRadius*0.6 and cy)
      const hourWidth = Math.max(2, width * 0.035);
      if (Math.abs(dxCenter) < hourWidth && dyCenter <= 0 && dyCenter >= -dialRadius * 0.6) {
        r = 255;
        g = 255;
        b = 255;
      }

      // 3. Minute hand: pointing right (y ≈ cy, x between cx and cx + dialRadius*0.6)
      if (Math.abs(dyCenter) < hourWidth && dxCenter >= 0 && dxCenter <= dialRadius * 0.6) {
        r = 255;
        g = 255;
        b = 255;
      }

      // 4. Center pivot dot
      if (distCenter < width * 0.03) {
        r = 255;
        g = 255;
        b = 255;
      }

      // 5. Geofence pulse dot (cyan #38bdf8 at top-right: cx + dialRadius*0.8, cy - dialRadius*0.8)
      const dotX = cx + dialRadius * 0.72;
      const dotY = cy - dialRadius * 0.72;
      const distDot = Math.sqrt((x - dotX) * (x - dotX) + (y - dotY) * (y - dotY));
      const dotRadius = Math.max(2, width * 0.03);
      if (distDot < dotRadius) {
        r = 56;
        g = 189;
        b = 248; // #38bdf8
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }

  // Format into PNG file
  return encodePng(width, height, rgba);
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (color type 6: RGBA)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Scanline filter byte 0
  const rowBytes = 1 + width * 4;
  const rawScanlines = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * rowBytes;
    rawScanlines[rawOffset] = 0; // Filter None
    const rgbaOffset = y * width * 4;
    rgbaBuffer.copy(rawScanlines, rawOffset + 1, rgbaOffset, rgbaOffset + width * 4);
  }

  const compressedData = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([len, body, crcBuf]);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

console.log('Rendering minimal PNG icons...');
const png192 = renderMinimalIconPng(192);
fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), png192);

const png512 = renderMinimalIconPng(512);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), png512);

console.log('Minimal 192x192 and 512x512 PNGs generated successfully!');
