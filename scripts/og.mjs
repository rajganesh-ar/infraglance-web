// Renders the default Open Graph image (1200x630) from an inline SVG.
// Usage: node scripts/og.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const grid = [];
for (let x = 0; x <= 1200; x += 48) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="630"/>`);
for (let y = 0; y <= 630; y += 48) grid.push(`<line x1="0" y1="${y}" x2="1200" y2="${y}"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="80%" cy="10%" r="70%"><stop offset="0" stop-color="#22d3ee" stop-opacity="0.28"/><stop offset="1" stop-color="#07090d" stop-opacity="0"/></radialGradient>
    <linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#e6edf3"/><stop offset="0.6" stop-color="#22d3ee"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#07090d"/>
  <g stroke="#1c2a38" stroke-width="1" opacity="0.6">${grid.join('')}</g>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(80 80) scale(2.2)" fill="none">
    <path d="M3 10V5a2 2 0 0 1 2-2h5M22 3h5a2 2 0 0 1 2 2v5M29 22v5a2 2 0 0 1-2 2h-5M10 29H5a2 2 0 0 1-2-2v-5" stroke="#22D3EE" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M7 16s3.6-6 9-6 9 6 9 6-3.6 6-9 6-9-6-9-6Z" stroke="#E6EDF3" stroke-width="1.8"/>
    <circle cx="16" cy="16" r="2.8" fill="#22D3EE"/>
  </g>
  <text x="166" y="128" font-family="Segoe UI, Arial, sans-serif" font-size="40" fill="#e6edf3">infra<tspan font-weight="700" fill="#22d3ee">glance</tspan></text>
  <text x="80" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="68" font-weight="700" fill="#e6edf3">See every risk, defect and failure</text>
  <text x="80" y="410" font-family="Segoe UI, Arial, sans-serif" font-size="68" font-weight="700" fill="url(#t)">before it costs you.</text>
  <text x="80" y="520" font-family="Consolas, monospace" font-size="24" fill="#8b98a5" letter-spacing="3">VISION AI FOR INDUSTRY &amp; INFRASTRUCTURE</text>
  <g font-family="Consolas, monospace" font-size="20">
    <text x="80" y="570" fill="#f59e0b">GUARD</text><text x="190" y="570" fill="#22d3ee">INSPECT</text><text x="320" y="570" fill="#3b82f6">FLOW</text><text x="410" y="570" fill="#2dd4bf">SENSE</text><text x="510" y="570" fill="#22c55e">INFRA</text>
  </g>
</svg>`;

mkdirSync('public/og', { recursive: true });
await sharp(Buffer.from(svg)).png().toFile('public/og/default.png');
console.log('wrote public/og/default.png');
