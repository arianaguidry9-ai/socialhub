// Generate placeholder PNG icons for SocialHub
// Run: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const publicDir = path.join(__dirname, '..', 'public');

// Create a minimal valid PNG with a solid color
function createPNG(width, height, r, g, b) {
  // PNG file: signature + IHDR + IDAT + IEND

  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image data: each row = filter byte (0) + RGB pixels
  const rawRow = Buffer.alloc(1 + width * 3);
  rawRow[0] = 0; // no filter
  for (let x = 0; x < width; x++) {
    rawRow[1 + x * 3] = r;
    rawRow[2 + x * 3] = g;
    rawRow[3 + x * 3] = b;
  }
  const rawData = Buffer.concat(Array(height).fill(rawRow));
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Indigo-500: #6366f1 = rgb(99, 102, 241)
const R = 99, G = 102, B = 241;

const icons = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const icon of icons) {
  const png = createPNG(icon.size, icon.size, R, G, B);
  fs.writeFileSync(path.join(publicDir, icon.name), png);
  console.log(`Created ${icon.name} (${icon.size}x${icon.size})`);
}

// Create favicon.ico from the SVG (just copy the SVG as .ico for dev — browsers accept it)
// For production, convert the SVG to a proper .ico file
const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#6366f1"/>
  <text x="16" y="23" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-weight="bold" font-size="20">S</text>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), svgFavicon);
console.log('Created favicon.ico (SVG-based, replace with real .ico for production)');

console.log('\nDone! Replace these placeholders with real branded icons before release.');
