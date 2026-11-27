// Vector detection-overlay primitives (viewBox 0 0 2400 1350), styled like the site's CameraFeed / 3D chips.
// All sizes are in viewBox px. Text is IBM Plex Mono 500 (advance 0.6 em), so chip widths are exact.
export const SEV = { bad: '#ef4444', warn: '#f59e0b', ok: '#22c55e', info: '#22d3ee', neutral: '#c3cdd8' };
export const INK = 'rgb(5 7 11 / 0.86)';
const FS = 31; // chip font size
const CH = 54; // chip height
const PAD = 18;
const DOT = 7;
const ADV = 0.6; // Plex Mono advance per em
const MONO = `'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace`;
const SANS = `'IBM Plex Sans Variable', 'IBM Plex Sans', system-ui, sans-serif`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (n) => Math.round(n * 10) / 10;

export class Overlay {
  /** k: chip scale (thumb overlays use ~2.4); sw: stroke scale for boxes, leaders and zones. */
  constructor(id, { k = 1, sw = 1 } = {}) { this.id = id; this.k = k; this.sw = sw; this.defs = []; this.back = []; this.mid = []; this.front = []; this.boxes = []; }

  /** Text width for mono text at size fs. */
  static tw(text, fs = FS) { return [...text].length * ADV * fs; }

  /** Chip. parts: string or [[text, 'main'|'dim'|sev], ...]. Positioned by its anchor point: at = [x, y], anchor 'tl'|'tr'|'bl'|'br'|'ml'|'mr'.
   *  sub: optional second line (smaller, dim). Returns the chip rect {x, y, w, h}. */
  chip({ at, anchor = 'tl', parts, sev = 'info', sub, dot = true, layer = 'front', fs = FS * this.k, live = false }) {
    if (typeof parts === 'string') parts = [[parts, 'main']];
    const k = this.k, PAD = 18 * k, DOT = 7 * k, CH = 54 * k;
    const text = parts.map((p) => p[0]).join('');
    const subFs = Math.round(fs * 0.8);
    const lead = dot ? PAD + DOT * 2 + 12 * k : PAD;
    const w = Math.round(lead + Math.max(Overlay.tw(text, fs), sub ? Overlay.tw(sub, subFs) : 0) + PAD);
    const h = sub ? Math.round(CH + subFs * 1.25) : CH;
    let [x, y] = at;
    if (anchor.includes('r')) x -= w;
    if (anchor[0] === 'b') y -= h;
    if (anchor[0] === 'm') y -= h / 2;
    x = Math.min(Math.max(x, 380), 2020 - w); // contract: chips stay within x 380–2020
    x = Math.round(x); y = Math.round(y);
    const c = SEV[sev] ?? sev;
    const fill = { main: '#eef3f8', dim: '#9ba7b5' };
    const tspans = parts.map(([t, k]) => `<tspan fill="${fill[k] ?? SEV[k] ?? k}">${esc(t)}</tspan>`).join('');
    const ty = y + CH / 2 + fs * 0.35;
    let s = `<g class="chip">`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${4 * k}" fill="${INK}" stroke="${c}" stroke-width="${2 * Math.min(k, 1.5)}"/>`;
    if (dot) s += live
      ? `<circle cx="${x + PAD + DOT}" cy="${y + CH / 2}" r="${DOT}" fill="#ef4444"/>`
      : `<circle cx="${x + PAD + DOT}" cy="${y + CH / 2}" r="${DOT}" fill="${c}"/>`;
    s += `<text x="${x + lead}" y="${r1(ty)}" font-family="${MONO}" font-weight="500" font-size="${fs}" letter-spacing="0">${tspans}</text>`;
    if (sub) s += `<text x="${x + lead}" y="${r1(ty + subFs * 1.3)}" font-family="${MONO}" font-weight="400" font-size="${subFs}" fill="#9ba7b5">${esc(sub)}</text>`;
    s += `</g>`;
    this[layer].push(s);
    return { x, y, w, h, l: [x, y + h / 2], r: [x + w, y + h / 2], t: [x + w / 2, y], b: [x + w / 2, y + h] };
  }

  /** Box with corner ticks. label: { parts, sev, pos: 'top'|'top-r'|'bottom'|'bottom-r'|'in-top'|'in-bottom' } */
  box({ x, y, w, h, sev = 'info', label, tick, fillOpacity = 0.06, dashed = false }) {
    const c = SEV[sev] ?? sev;
    const t = tick ?? Math.round(Math.max(14, Math.min(34, w / 5, h / 5)));
    const x2 = x + w, y2 = y + h;
    let s = `<g class="box">`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" fill-opacity="${fillOpacity}" stroke="rgb(5 7 11 / 0.35)" stroke-width="${7 * this.sw}"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${c}" stroke-width="${3 * this.sw}"${dashed ? ' stroke-dasharray="14 10"' : ''}/>`;
    const o = 2.5 * this.sw; // ticks sit on the outside edge of the stroke
    s += `<path d="M${x - o},${y + t} V${y - o} H${x + t} M${x2 - t},${y - o} H${x2 + o} V${y + t} M${x2 + o},${y2 - t} V${y2 + o} H${x2 - t} M${x + t},${y2 + o} H${x - o} V${y2 - t}" fill="none" stroke="${c}" stroke-width="${7 * this.sw}" stroke-linecap="square"/>`;
    s += `</g>`;
    this.mid.push(s);
    let chip;
    if (label) {
      const pos = label.pos ?? 'top';
      const g = 8;
      const at = { top: [x - 2.5, y - g], 'top-r': [x2 + 2.5, y - g], bottom: [x - 2.5, y2 + g], 'bottom-r': [x2 + 2.5, y2 + g], 'in-top': [x + 12, y + 12], 'in-bottom': [x + 12, y2 - 12], 'in-top-r': [x2 - 12, y + 12] }[pos];
      const anchor = { top: 'bl', 'top-r': 'br', bottom: 'tl', 'bottom-r': 'tr', 'in-top': 'tl', 'in-bottom': 'bl', 'in-top-r': 'tr' }[pos];
      chip = this.chip({ at, anchor, parts: label.parts, sev: label.sev ?? sev, sub: label.sub });
    }
    this.boxes.push({ x, y, w, h });
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, chip };
  }

  /** Leader line from a chip edge (or any point) to a target point on the object; elbow: 'h' | 'v' | null. */
  leader({ from, to, sev = 'info', elbow = null }) {
    const c = SEV[sev] ?? sev;
    let pts = [from, to];
    if (elbow === 'h') pts = [from, [to[0], from[1]], to];
    if (elbow === 'v') pts = [from, [from[0], to[1]], to];
    if (Array.isArray(elbow)) pts = [from, ...elbow, to];
    const d = 'M' + pts.map((p) => p.map(r1).join(',')).join(' L');
    let s = `<g class="leader">`;
    s += `<path d="${d}" fill="none" stroke="rgb(5 7 11 / 0.4)" stroke-width="${5 * this.sw}" stroke-linejoin="round"/>`;
    s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${2 * this.sw}" stroke-linejoin="round"/>`;
    s += `<circle cx="${r1(to[0])}" cy="${r1(to[1])}" r="${8 * this.sw}" fill="${c}" stroke="rgb(5 7 11 / 0.8)" stroke-width="3"/>`;
    s += `<circle cx="${r1(to[0])}" cy="${r1(to[1])}" r="${18 * this.sw}" fill="none" stroke="${c}" stroke-width="${2 * this.sw}" stroke-opacity="0.55"/>`;
    s += `</g>`;
    this.back.push(s);
  }

  /** Dashed zone polygon with 10 % fill. */
  zone({ points, sev = 'warn', dash = '16 12', fillOpacity = 0.1 }) {
    const c = SEV[sev] ?? sev;
    const p = points.map((q) => q.map(r1).join(',')).join(' ');
    this.back.unshift(`<g class="zone"><polygon points="${p}" fill="${c}" fill-opacity="${fillOpacity}" stroke="${c}" stroke-width="${3 * this.sw}" stroke-dasharray="${dash}" stroke-linejoin="round"/></g>`);
  }

  /** Dashed ellipse (proximity ring / ground radius). */
  ring({ cx, cy, rx, ry, sev = 'warn', fillOpacity = 0.08, dash = '16 12' }) {
    const c = SEV[sev] ?? sev;
    this.back.unshift(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" fill-opacity="${fillOpacity}" stroke="${c}" stroke-width="${3 * this.sw}" stroke-dasharray="${dash}"/>`);
  }

  /** Polyline trace (e.g. a crack or belt edge). */
  trace({ points, sev = 'bad', width = 4, dash = null, halo = true, opacity = 1 }) {
    const c = SEV[sev] ?? sev;
    const d = 'M' + points.map((p) => p.map(r1).join(',')).join(' L');
    let s = '';
    if (halo) s += `<path d="${d}" fill="none" stroke="rgb(5 7 11 / 0.45)" stroke-width="${width + 4}" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-opacity="${opacity}"/>`;
    this.back.push(`<g class="trace">${s}</g>`);
  }

  /** Dimension line between two points with end bars, label chip placed by caller. */
  dim({ a, b, sev = 'info', bar = 16 }) {
    const c = SEV[sev] ?? sev;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * bar, ny = (dx / L) * bar;
    const seg = (p) => `M${r1(p[0] - nx)},${r1(p[1] - ny)} L${r1(p[0] + nx)},${r1(p[1] + ny)}`;
    const d = `M${r1(a[0])},${r1(a[1])} L${r1(b[0])},${r1(b[1])} ${seg(a)} ${seg(b)}`;
    this.mid.push(`<g class="dim"><path d="${d}" fill="none" stroke="rgb(5 7 11 / 0.45)" stroke-width="${6 * this.sw}"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${2.5 * this.sw}"/></g>`);
  }

  /** Soft radial heat blob (anomaly map / thermal hot spot), vector gradient. */
  heat({ cx, cy, rx, ry, stops, rotate = 0, opacity = 0.85 }) {
    const id = `${this.id}-heat-${this.defs.length}`;
    const st = (stops ?? [[0, '#fff3b0', 0.95], [0.25, '#f59e0b', 0.8], [0.55, '#ef4444', 0.45], [1, '#ef4444', 0]])
      .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
    this.defs.push(`<radialGradient id="${id}">${st}</radialGradient>`);
    this.back.unshift(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id})" opacity="${opacity}" transform="rotate(${rotate} ${cx} ${cy})"/>`);
  }

  /** Quadrilateral detection (perspective or rotated objects) with corner ticks. */
  quad({ points, sev = 'info', dashed = false, fillOpacity = 0.05, tick = 30 }) {
    const c = SEV[sev] ?? sev;
    const p = points.map((q) => q.map(r1).join(',')).join(' ');
    let s = `<g class="quad"><polygon points="${p}" fill="${c}" fill-opacity="${fillOpacity}" stroke="rgb(5 7 11 / 0.35)" stroke-width="${7 * this.sw}" stroke-linejoin="round"/>`;
    s += `<polygon points="${p}" fill="none" stroke="${c}" stroke-width="${3 * this.sw}" stroke-linejoin="round"${dashed ? ' stroke-dasharray="14 10"' : ''}/>`;
    let d = '';
    points.forEach((q, i) => {
      const a = points[(i + points.length - 1) % points.length], b = points[(i + 1) % points.length];
      const u = (v) => { const L = Math.hypot(v[0] - q[0], v[1] - q[1]); const k = Math.min(tick, L / 4) / L; return [q[0] + (v[0] - q[0]) * k, q[1] + (v[1] - q[1]) * k]; };
      const pa = u(a), pb = u(b);
      d += `M${r1(pa[0])},${r1(pa[1])} L${r1(q[0])},${r1(q[1])} L${r1(pb[0])},${r1(pb[1])} `;
    });
    s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${7 * this.sw}" stroke-linejoin="miter"/></g>`;
    this.mid.push(s);
  }

  raw(svg, layer = 'mid') { this[layer].push(svg); }

  /** HUD line (top-left camera id etc.). */
  hud({ at, anchor = 'tl', text, live = false }) {
    return this.chip({ at, anchor, parts: [[text, 'main']], sev: '#46566a', dot: live, live });
  }

  toString() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 1350" width="2400" height="1350" font-family="${MONO}">` +
      (this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '') +
      `<g class="det-back">${this.back.join('')}</g><g class="det-mid">${this.mid.join('')}</g><g class="det-front">${this.front.join('')}</g></svg>\n`;
  }
}
export { SANS, MONO };
