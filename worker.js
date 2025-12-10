// Cloudflare Worker to generate OG image (PNG) and share page for Queens Puzzle
// Deploy this via Cloudflare Workers

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.searchParams.get('p');
    const t = url.searchParams.get('t') || '';
    if (!p) return new Response('missing p', { status: 400 });

    try {
      const puzzle = decodePuzzle(p);
      if (url.pathname === '/og') {
        const png = renderPng(puzzle);
        return new Response(png, {
          headers: {
            'content-type': 'image/png',
            'cache-control': 'public, max-age=31536000'
          }
        });
      }
      // default to share page
      const ogImg = `${url.origin}/og?p=${encodeURIComponent(p)}`;
      const gameUrl = `https://rohithathreya.github.io/QueensGame/?p=${encodeURIComponent(p)}&t=${encodeURIComponent(t)}`;
      const title = 'Queens Puzzle Challenge';
      const desc = t ? `I solved this puzzle in ${formatTime(t)}. Can you beat me?` : 'Can you beat my time?';
      const html = `<!doctype html><html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="${(puzzle.size * 32 + 32)}">
<meta property="og:image:height" content="${(puzzle.size * 32 + 32)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${ogImg}">
<meta http-equiv="refresh" content="0;url=${gameUrl}">
</head><body style="background:#0a0e1a;color:#e8edf5;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px;">
<h1>${title}</h1>
<p>${desc}</p>
<p>Redirecting to puzzle...</p>
<p><a href="${gameUrl}" style="color:#8ab4ff;">Click here if not redirected</a></p>
</body></html>`;
      return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
    } catch (err) {
      return new Response('bad puzzle: ' + err.message, { status: 400 });
    }
  }
};

// Generate PNG image
function renderPng(puzzle) {
  const palette = [
    [255, 59, 48],    // Red
    [0, 122, 255],    // Blue
    [52, 199, 89],    // Green
    [255, 149, 0],    // Orange
    [175, 82, 222],   // Purple
    [0, 199, 190],    // Cyan
    [255, 204, 0],    // Yellow
    [255, 45, 146],   // Magenta
    [139, 195, 74],   // Lime
    [121, 85, 72]     // Brown
  ];

  const size = puzzle.size;
  const cellSize = 32;
  const pad = 16;
  const width = pad * 2 + cellSize * size;
  const height = width;

  // Create pixel data (RGBA)
  const pixels = new Uint8Array(width * height * 4);

  // Fill background
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = 10;   // R
    pixels[i * 4 + 1] = 14;   // G
    pixels[i * 4 + 2] = 26;   // B
    pixels[i * 4 + 3] = 255;  // A
  }

  // Draw cells
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const regionId = puzzle.regions[r][c];
      const color = palette[regionId % palette.length];
      const startX = pad + c * cellSize;
      const startY = pad + r * cellSize;

      for (let dy = 0; dy < cellSize - 2; dy++) {
        for (let dx = 0; dx < cellSize - 2; dx++) {
          const px = startX + dx;
          const py = startY + dy;
          const idx = (py * width + px) * 4;
          pixels[idx + 0] = color[0];
          pixels[idx + 1] = color[1];
          pixels[idx + 2] = color[2];
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  // Apply simple box blur (3x3) for slight blur effect
  const blurred = applyBlur(pixels, width, height, 2);

  // Encode as PNG
  return encodePng(blurred, width, height);
}

function applyBlur(pixels, width, height, passes) {
  let src = new Uint8Array(pixels);
  let dst = new Uint8Array(pixels.length);

  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              r += src[idx + 0];
              g += src[idx + 1];
              b += src[idx + 2];
              count++;
            }
          }
        }

        const idx = (y * width + x) * 4;
        dst[idx + 0] = Math.round(r / count);
        dst[idx + 1] = Math.round(g / count);
        dst[idx + 2] = Math.round(b / count);
        dst[idx + 3] = 255;
      }
    }
    [src, dst] = [dst, src];
  }

  return src;
}

function encodePng(pixels, width, height) {
  // PNG signature
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];

  // IHDR chunk
  const ihdr = createIhdrChunk(width, height);

  // IDAT chunk (image data)
  const idat = createIdatChunk(pixels, width, height);

  // IEND chunk
  const iend = createIendChunk();

  // Combine all
  const totalLen = signature.length + ihdr.length + idat.length + iend.length;
  const png = new Uint8Array(totalLen);
  let offset = 0;

  png.set(signature, offset); offset += signature.length;
  png.set(ihdr, offset); offset += ihdr.length;
  png.set(idat, offset); offset += idat.length;
  png.set(iend, offset);

  return png;
}

function createIhdrChunk(width, height) {
  const data = new Uint8Array(13);
  writeUint32(data, 0, width);
  writeUint32(data, 4, height);
  data[8] = 8;  // bit depth
  data[9] = 6;  // color type (RGBA)
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace

  return createChunk('IHDR', data);
}

function createIdatChunk(pixels, width, height) {
  // Add filter byte (0) to each row
  const rowSize = width * 4 + 1;
  const filtered = new Uint8Array(height * rowSize);

  for (let y = 0; y < height; y++) {
    filtered[y * rowSize] = 0; // filter type: none
    for (let x = 0; x < width * 4; x++) {
      filtered[y * rowSize + 1 + x] = pixels[y * width * 4 + x];
    }
  }

  // Compress with deflate (using simple zlib wrapper)
  const compressed = deflateSimple(filtered);

  return createChunk('IDAT', compressed);
}

function createIendChunk() {
  return createChunk('IEND', new Uint8Array(0));
}

function createChunk(type, data) {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);

  // Length
  writeUint32(chunk, 0, data.length);

  // Type
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }

  // Data
  chunk.set(data, 8);

  // CRC
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  writeUint32(chunk, 8 + data.length, crc);

  return chunk;
}

function writeUint32(arr, offset, value) {
  arr[offset + 0] = (value >> 24) & 0xff;
  arr[offset + 1] = (value >> 16) & 0xff;
  arr[offset + 2] = (value >> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

// Simple deflate: store blocks (no compression, just framing)
function deflateSimple(data) {
  const maxBlock = 65535;
  const numBlocks = Math.ceil(data.length / maxBlock);
  const output = [];

  // zlib header
  output.push(0x78, 0x01);

  for (let i = 0; i < numBlocks; i++) {
    const start = i * maxBlock;
    const end = Math.min(start + maxBlock, data.length);
    const block = data.subarray(start, end);
    const len = block.length;
    const isLast = (i === numBlocks - 1) ? 1 : 0;

    output.push(isLast); // BFINAL + BTYPE=00 (stored)
    output.push(len & 0xff, (len >> 8) & 0xff);
    output.push((~len) & 0xff, ((~len) >> 8) & 0xff);

    for (let j = 0; j < block.length; j++) {
      output.push(block[j]);
    }
  }

  // Adler-32 checksum
  const adler = adler32(data);
  output.push((adler >> 24) & 0xff);
  output.push((adler >> 16) & 0xff);
  output.push((adler >> 8) & 0xff);
  output.push(adler & 0xff);

  return new Uint8Array(output);
}

function adler32(data) {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

// CRC32 table
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function decodePuzzle(code) {
  const bytes = fromBase64Url(code);
  const size = bytes[0];
  const regLen = bytes[1] | (bytes[2] << 8);
  const solLen = bytes[3] | (bytes[4] << 8);
  const regBuf = bytes.slice(5, 5 + regLen);
  const solBuf = bytes.slice(5 + regLen, 5 + regLen + solLen);
  const cells = size * size;
  const regionsFlat = unpackBits(regBuf, cells, 3);
  const solutionFlat = unpackBits(solBuf, cells, 1);
  const regions = [];
  const solution = [];
  for (let r = 0; r < size; r++) {
    regions.push([]);
    solution.push([]);
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      regions[r][c] = regionsFlat[idx];
      solution[r][c] = solutionFlat[idx];
    }
  }
  return { size, regions, solution };
}

function unpackBits(buf, count, bitsPerValue) {
  const out = [];
  let bitPos = 0;
  for (let i = 0; i < count; i++) {
    let v = 0;
    for (let b = 0; b < bitsPerValue; b++) {
      const byteIndex = bitPos >> 3;
      const bitIndex = bitPos & 7;
      if (buf[byteIndex] & (1 << bitIndex)) v |= (1 << b);
      bitPos++;
    }
    out.push(v);
  }
  return out;
}

function fromBase64Url(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function formatTime(sec) {
  const s = parseInt(sec, 10) || 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
