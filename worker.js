// Cloudflare Worker to generate OG image and share page for Queens Puzzle
// Deploy this via Cloudflare Workers (no external accounts needed beyond CF).
// Expected query params:
//   p: base64url puzzle code (matches ui.js encoder: 1 byte size, 2+2 lengths, 3 bits/region cell, 1 bit/solution cell)
//   t: optional time in seconds for display

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.searchParams.get('p');
    const t = url.searchParams.get('t') || '';
    if (!p) return new Response('missing p', { status: 400 });

    try {
      const puzzle = decodePuzzle(p);
      if (url.pathname === '/og') {
        return new Response(renderSvg(puzzle), { headers: { 'content-type': 'image/svg+xml' } });
      }
      // default to share page
      const ogImg = `${url.origin}/og?p=${encodeURIComponent(p)}`;
      const title = 'Queens Puzzle Challenge';
      const desc = t ? `I solved this puzzle in ${formatTime(t)}. Can you beat me?` : 'Can you beat my time?';
      const html = `<!doctype html><html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${ogImg}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImg}">
</head><body style="background:#0a0e1a;color:#e8edf5;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px;">
<h1>${title}</h1>
<p>${desc}</p>
<img src="${ogImg}" alt="Puzzle preview" style="max-width:480px;width:100%;filter:blur(6px);border-radius:8px;"/>
<p><a href="https://rohithathreya.github.io/QueensGame/?p=${encodeURIComponent(p)}&t=${encodeURIComponent(t)}" style="color:#8ab4ff;">Play this puzzle</a></p>
</body></html>`;
      return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
    } catch (err) {
      return new Response('bad puzzle', { status: 400 });
    }
  }
};

function renderSvg(puzzle) {
  const palette = ['#FF3B30', '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#00C7BE', '#FFCC00', '#FF2D92', '#8BC34A', '#795548'];
  const size = puzzle.size;
  const cell = 32;
  const pad = 16;
  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const regionId = puzzle.regions[r][c];
      const color = palette[regionId % palette.length];
      const x = pad + c * cell;
      const y = pad + r * cell;
      rects += `<rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" fill="${color}"/>`;
    }
  }
  const w = pad * 2 + cell * size;
  const h = w;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><filter id="blur"><feGaussianBlur stdDeviation="5"/></filter></defs>
  <rect width="100%" height="100%" fill="#0a0e1a"/>
  <g filter="url(#blur)">${rects}</g>
</svg>`;
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

