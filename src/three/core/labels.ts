import { Vector3, type Object3D, type PerspectiveCamera } from 'three';

export type LabelTone = 'ok' | 'warn' | 'bad' | 'info';

export interface Label {
  el: HTMLDivElement;
  setText(text: string): void;
  setTone(tone: LabelTone): void;
  setVisible(v: boolean): void;
}

export interface LabelOptions {
  /**
   * Prefer a spot below the anchor, with the leader running up to it (e.g. for something under a belt,
   * so the chip does not cover the belt). Falls back to the spots above when there is no room below.
   */
  below?: boolean;
}

/** Area of the canvas (CSS px) where labels may appear, e.g. not under a text panel. */
export interface SafeArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type Labels = ReturnType<typeof createLabels>;

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

interface Entry extends Label {
  getPos: () => Vector3;
  /** The object the label is pinned to (its own obstacle is not avoided). */
  target: Object3D | null;
  visible: boolean;
  tone: LabelTone;
  text: string;
  textEl: HTMLSpanElement;
  shown: boolean;
  /** Placements to try, in order (indices into SLOTS); the first is the default spot. */
  order: number[];
  /** Placement used last frame (index into SLOTS): kept while it stays clear, so chips do not hop. */
  slot: number;
}

/** Something chips must not cover, e.g. a person: an upright box from `top` down `height()` metres. */
interface Obstacle {
  top: Object3D;
  height: () => number;
  on: () => boolean;
  halfWidth: number;
  rect: Rect | null;
}

const PRIORITY: Record<LabelTone, number> = { bad: 3, warn: 2, ok: 1, info: 0 };
/** Leader line length below the chip (px); matches the ::after default. */
const LEAD = 10;
const GAP = 4;
/** Horizontal gap (px) between the anchor and a chip placed beside it. */
const SIDE = 10;
/**
 * Chip placements: [side, row]. side 0 = centred on the anchor, 1 = to the right, -1 = to the left.
 * Row 0 and up sit above the anchor (each row lifts the chip one chip height); row -1 hangs below it.
 */
const SLOTS: [number, number][] = [[0, 0], [0, 1], [1, 0], [-1, 0], [1, 1], [-1, 1], [0, 2], [0, -1], [1, -1], [-1, -1]];
/** Default order: above only. `below` labels try the hanging spots first, then the ones above. */
const ABOVE = [0, 1, 2, 3, 4, 5, 6];
const BELOW = [7, 8, 9, 0, 1, 2, 3, 4, 5, 6];
const RAD2DEG = 180 / Math.PI;

/**
 * HTML labels pinned to 3D positions: white chips with a status dot and a
 * leader line to the anchor. Projected every frame, snapped to whole pixels
 * (crisp text), faded with distance and kept inside a safe area (a label hides
 * only when its anchor leaves the area). Each chip takes the first placement
 * (above, raised, or to one side with an angled leader; below for `below`
 * labels) where neither the chip nor its leader crosses a chip or leader placed
 * before it or an obstacle such as a person, a detection box or a measured
 * defect. Higher priority places first (bad > warn > ok > info). When nothing
 * is clear, an exception (bad, warn) takes the spot clear of chips and leaders
 * that covers obstacles least; ok/info labels (and an exception with no such
 * spot) hide until there is room.
 */
export function createLabels(container: HTMLElement, camera: PerspectiveCamera, maxDist = 80) {
  const layer = document.createElement('div');
  layer.className = 'scene-labels';
  layer.setAttribute('aria-hidden', 'true');
  container.appendChild(layer);
  const entries: Entry[] = [];
  const obstacles: Obstacle[] = [];
  const v = new Vector3();
  const v2 = new Vector3();
  const side = new Vector3();
  const widths = new Map<string, number>();
  let chipH = 0;
  let safe: SafeArea | null = null;
  const onFonts = () => widths.clear();
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  function add(text: string, target: Object3D | Vector3, offset = new Vector3(0, 0, 0), tone: LabelTone = 'info', opts: LabelOptions = {}): Label {
    const order = opts.below ? BELOW : ABOVE;
    const el = document.createElement('div');
    el.className = `scene-label tone-${tone}`;
    const dot = document.createElement('i');
    dot.className = 'dot';
    const textEl = document.createElement('span');
    textEl.textContent = text;
    el.appendChild(dot);
    el.appendChild(textEl);
    el.style.opacity = '0';
    layer.appendChild(el);
    const tmp = new Vector3();
    const getPos =
      target instanceof Vector3 ? () => tmp.copy(target).add(offset) : () => (target as Object3D).getWorldPosition(tmp).add(offset);
    const entry: Entry = {
      el,
      textEl,
      getPos,
      target: target instanceof Vector3 ? null : target,
      visible: true,
      tone,
      text,
      shown: false,
      order,
      slot: order[0],
      setText: (t) => {
        if (entry.text === t) return;
        entry.text = t;
        textEl.textContent = t;
      },
      setTone: (tn) => {
        if (entry.tone === tn) return;
        entry.tone = tn;
        el.className = `scene-label tone-${tn}`;
      },
      setVisible: (vis) => {
        entry.visible = vis;
      },
    };
    entries.push(entry);
    return entry;
  }

  /**
   * Keeps chips and leaders off an upright thing, e.g. a person and their detection box: from `top`
   * (the Object3D's world position) down `height()` metres, `halfWidth` metres either side. While
   * `on()` is false (not loaded yet, hidden) there is nothing to avoid. A label pinned to `top` ignores it.
   */
  function avoid(top: Object3D, height: () => number, on: () => boolean = () => true, halfWidth = 0.5) {
    obstacles.push({ top, height, on, halfWidth, rect: null });
  }

  const widthOf = (e: Entry) => {
    let w = widths.get(e.text);
    if (w === undefined) {
      w = e.el.offsetWidth;
      if (w > 0) widths.set(e.text, w);
    }
    if (!chipH) chipH = e.el.offsetHeight || 22;
    return w;
  };

  /** Screen rectangle (CSS px) of an obstacle, or null when it is off or behind the camera. */
  function project(o: Obstacle, width: number, height: number): Rect | null {
    if (!o.on()) return null;
    o.top.getWorldPosition(v);
    v2.copy(v);
    v2.y -= o.height();
    side.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(o.halfWidth).add(v);
    v.project(camera);
    v2.project(camera);
    side.project(camera);
    if (v.z > 1 || v2.z > 1) return null;
    const x1 = (v.x * 0.5 + 0.5) * width, y1 = (-v.y * 0.5 + 0.5) * height;
    const x2 = (v2.x * 0.5 + 0.5) * width, y2 = (-v2.y * 0.5 + 0.5) * height;
    const hw = Math.abs((side.x * 0.5 + 0.5) * width - x1) + 2;
    return { l: Math.min(x1, x2) - hw, r: Math.max(x1, x2) + hw, t: Math.min(y1, y2) - 2, b: Math.max(y1, y2) + 2 };
  }

  type Cand = { e: Entry; x: number; y: number; w: number; dist: number; fade: number };
  /** Chips and leader boxes placed so far this frame. */
  const placed: Rect[] = [];
  const leads: Rect[] = [];
  const overlap = (a: Rect, b: Rect, m: number) => a.l < b.r + m && a.r > b.l - m && a.t < b.b + m && a.b > b.t - m;

  function hide(e: Entry) {
    e.slot = e.order[0];
    if (!e.shown) return;
    e.shown = false;
    e.el.style.opacity = '0';
  }

  function update(width: number, height: number) {
    for (const o of obstacles) o.rect = project(o, width, height);
    const cands: Cand[] = [];
    for (const e of entries) {
      if (!e.visible) {
        hide(e);
        continue;
      }
      v.copy(e.getPos());
      const dist = v.distanceTo(camera.position);
      v.project(camera);
      const fade = Math.max(0, Math.min(1, (maxDist - dist) / (maxDist * 0.35)));
      if (v.z > 1 || fade <= 0.02) {
        hide(e);
        continue;
      }
      cands.push({ e, x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, w: 0, dist, fade });
    }
    cands.sort((a, b) => PRIORITY[b.e.tone] - PRIORITY[a.e.tone] || a.dist - b.dist);
    placed.length = 0;
    leads.length = 0;
    const box = safe ?? { left: 0, top: 0, right: width, bottom: height };
    for (const c of cands) {
      c.w = widthOf(c.e);
      const h = chipH;
      const { order } = c.e;
      const roomAbove = c.y >= box.top + h + 6;
      // Hide only when the thing itself is outside the free area (or, for a chip that only goes above it, too close to its top).
      if (c.x < box.left || c.x > box.right || c.y > box.bottom - 2 || c.y < box.top + 2 || (!roomAbove && order === ABOVE)) {
        hide(c.e);
        continue;
      }
      const own = c.e.target;
      /** The chip's rectangle in a placement, or null when that placement does not fit in the free area. */
      const rectAt = (slot: number): Rect | null => {
        const [sx, row] = SLOTS[slot];
        const l0 = sx === 0 ? c.x - c.w / 2 : sx > 0 ? c.x + SIDE : c.x - SIDE - c.w;
        // Clamped sideways into the free area (the leader still points at the anchor).
        const l = Math.round(Math.max(box.left + 2, Math.min(l0, box.right - 2 - c.w)));
        if (row < 0) {
          const t = Math.round(c.y + LEAD + (-row - 1) * (h + GAP) + (sx === 0 ? 0 : 4));
          return t + h > box.bottom - 2 ? null : { l, t, r: l + c.w, b: t + h };
        }
        if (!roomAbove) return null;
        const t = Math.round(Math.max(box.top + 2, c.y - LEAD - h - row * (h + GAP) - (sx === 0 ? 0 : 4)));
        return { l, t, r: l + c.w, b: t + h };
      };
      /** Box around the leader from the chip's nearest edge point to the anchor. */
      const leadOf = (r: Rect): Rect => {
        const ax = Math.max(r.l + 4, Math.min(r.r - 4, c.x));
        const l = Math.min(ax, c.x) - 1, rr = Math.max(ax, c.x) + 1;
        return r.t > c.y ? { l, r: rr, t: c.y, b: r.t } : { l, r: rr, t: r.b, b: c.y };
      };
      const hitsChip = (r: Rect, m: number) => placed.some((p) => overlap(r, p, m));
      /** The chip crosses a placed leader, or its leader crosses a placed chip. */
      const crossesLead = (r: Rect, ld: Rect) => leads.some((q) => overlap(r, q, 1)) || placed.some((p) => overlap(ld, p, 1));
      /** Area (px²) of obstacles under the rectangle grown by `m` px. */
      const covers = (r: Rect, m: number) => {
        let a = 0;
        for (const o of obstacles) {
          const q = o.rect;
          if (!q || o.top === own) continue;
          const ox = Math.min(r.r + m, q.r) - Math.max(r.l - m, q.l);
          const oy = Math.min(r.b + m, q.b) - Math.max(r.t - m, q.t);
          if (ox > 0 && oy > 0) a += ox * oy;
        }
        return a;
      };
      const clear = (s: number, m = 0) => {
        const r = rectAt(s);
        if (!r || hitsChip(r, GAP + m) || covers(r, m) > 0) return null;
        const ld = leadOf(r);
        return crossesLead(r, ld) || covers(ld, 0) > 0 ? null : r;
      };
      let slot = -1;
      let rect: Rect | null = null;
      const first = order[0];
      // Back to the default spot once it is clearly free; otherwise stay put while the last spot is clear.
      if (c.e.shown && c.e.slot !== first && (rect = clear(first, 6))) slot = first;
      else if (c.e.shown && (rect = clear(c.e.slot))) slot = c.e.slot;
      else for (const s of order) if ((rect = clear(s))) { slot = s; break; }
      if (!rect && PRIORITY[c.e.tone] >= 2) {
        // An exception still shows over an obstacle: the spot that covers the least, as long as neither the chip
        // nor its leader touches another chip or leader (that would pair the wrong chip and thing).
        let least = Infinity;
        for (const s of order) {
          const r = rectAt(s);
          if (!r || hitsChip(r, GAP)) continue;
          const ld = leadOf(r);
          if (crossesLead(r, ld)) continue;
          const a = covers(r, 0) + covers(ld, 0);
          if (a < least) {
            least = a;
            slot = s;
            rect = r;
          }
        }
      }
      if (!rect) {
        hide(c.e);
        continue;
      }
      placed.push(rect);
      leads.push(leadOf(rect));
      c.e.slot = slot;
      // Leader from the chip's bottom edge (top edge when it hangs below; or the nearest corner) to the anchor.
      const below = SLOTS[slot][1] < 0;
      const ax = Math.max(rect.l + 4, Math.min(rect.r - 4, c.x));
      const dx = c.x - ax;
      const dy = below ? Math.min(-2, c.y - rect.t) : Math.max(2, c.y - rect.b);
      const s = c.e.el.style;
      s.transform = `translate3d(${rect.l}px, ${rect.t}px, 0)`;
      s.setProperty('--lead', `${Math.round(Math.hypot(dx, dy))}px`);
      s.setProperty('--lead-x', `${Math.round(ax - rect.l)}px`);
      s.setProperty('--lead-top', below ? '0px' : '100%');
      s.setProperty('--lead-a', `${(Math.atan2(-dx, dy) * RAD2DEG).toFixed(1)}deg`);
      s.opacity = c.fade.toFixed(2);
      c.e.shown = true;
    }
  }

  return {
    add,
    avoid,
    update,
    /** Restrict labels to a rectangle of the canvas (CSS px); null for the whole canvas. */
    setSafeArea(r: SafeArea | null) {
      safe = r;
    },
    destroy: () => {
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      layer.remove();
    },
  };
}
