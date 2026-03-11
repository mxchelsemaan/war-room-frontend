import maplibregl from "maplibre-gl";

// ── Pulse ring image ────────────────────────────────────────────────────────

const PULSE_RING_SIZE = 128;        // canvas px (large enough for smooth scaling)
const PULSE_RING_STROKE = 4;        // stroke width in canvas px
/** Register a reusable red ring image for the pulse symbol layer */
export function registerPulseRingImage(map: maplibregl.Map) {
  if (map.hasImage("pulse-ring")) return;
  const size = PULSE_RING_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, (size - PULSE_RING_STROKE) / 2, 0, Math.PI * 2);
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = PULSE_RING_STROKE;
  ctx.stroke();
  map.addImage("pulse-ring", { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data });
}

/** Helper: add source + layers if not present, otherwise toggle visibility */
export function ensureLayers(
  map: maplibregl.Map,
  sourceId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourceSpec: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layerSpecs: any[],
  visible: boolean,
) {
  const vis = visible ? "visible" : "none";
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, sourceSpec);
  }
  if (!map.getLayer(layerSpecs[0].id)) {
    for (const spec of layerSpecs) {
      map.addLayer({ ...spec, layout: { ...spec.layout, visibility: vis } });
    }
  } else {
    for (const spec of layerSpecs) {
      map.setLayoutProperty(spec.id, "visibility", vis);
    }
  }
}

/** Render each unique emoji to a canvas and register as a MapLibre image */
export function registerEmojiImages(map: maplibregl.Map, emojis: string[]) {
  for (const emoji of emojis) {
    const key = `emoji-${emoji}`;
    if (map.hasImage(key)) continue;
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${size * 0.65}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, size / 2, size / 2);
    map.addImage(key, { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data });
  }
}

// ── Cluster badge image ──────────────────────────────────────────────────────

/** Register a pin-head-style circle used as background for cluster count badges.
 *  Matches the event pin look: glow + dark fill + colored border. */
export function registerClusterBadgeImage(map: maplibregl.Map, bgFill: string = PIN_BG_DARK, accentColor: string = "#6366f1") {
  if (map.hasImage("cluster-badge")) return;
  const size = HEAD;  // same resolution as pin heads (80px at 2×)
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Reuse the pin-head renderer without an emoji
  drawPinHead(ctx, size / 2, size / 2, accentColor, "", bgFill, "circle");
  map.addImage("cluster-badge", { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data });
}

// ── Generic map pin image system ─────────────────────────────────────────────

/** Theme-aware background fills for pins */
export const PIN_BG_DARK = "#0f172a";
export const PIN_BG_LIGHT = "#ffffff";

export type PinShape = "circle" | "square";

// All rendering at 2× for retina sharpness
const SCALE = 2;

const LOGICAL_SIZE = 40;          // logical px for the pin head
const LOGICAL_BORDER = 2.5;
const LOGICAL_GLOW = 8;
const LOGICAL_EMOJI = 18;
const LOGICAL_EMOJI_NUDGE = 2;    // emoji vertical nudge
const LOGICAL_STEM_H = 70;
const LOGICAL_STEM_W = 3;
const LOGICAL_SQUARE_RADIUS = 8;

const S = SCALE;
const HEAD = LOGICAL_SIZE * S;
const BORDER_W = LOGICAL_BORDER * S;
const GLOW_BLUR = LOGICAL_GLOW * S;
const EMOJI_PX = LOGICAL_EMOJI * S;
const EMOJI_NUDGE = LOGICAL_EMOJI_NUDGE * S;
const STEM_H = LOGICAL_STEM_H * S;
const STEM_W = LOGICAL_STEM_W * S;
const SQ_RADIUS = LOGICAL_SQUARE_RADIUS * S;
const TOTAL_H = HEAD + STEM_H;

/** Draw the pin head shape (glow + bg fill + border + emoji) */
function drawPinHead(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  color: string, emoji: string, bgFill: string,
  shape: PinShape,
) {
  const half = HEAD / 2;

  // ── Glow: fill shape with color so shadow renders, then cover with bg ──
  ctx.save();
  ctx.shadowColor = color + "66";
  ctx.shadowBlur = GLOW_BLUR;
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(cx, cy, half - 1, 0, Math.PI * 2);
  } else {
    ctx.roundRect(cx - half, cy - half, HEAD, HEAD, SQ_RADIUS);
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // ── Background fill (covers the colored fill, glow stays outside) ──
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(cx, cy, half - 1, 0, Math.PI * 2);
  } else {
    ctx.roundRect(cx - half, cy - half, HEAD, HEAD, SQ_RADIUS);
  }
  ctx.fillStyle = bgFill;
  ctx.fill();

  // ── Border (inset so outer edge aligns with fill edge) ──
  const inset = BORDER_W / 2;
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(cx, cy, half - 1 - inset, 0, Math.PI * 2);
  } else {
    ctx.roundRect(
      cx - half + inset, cy - half + inset,
      HEAD - BORDER_W, HEAD - BORDER_W,
      SQ_RADIUS - inset,
    );
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = BORDER_W;
  ctx.stroke();

  // ── Emoji (nudged down for visual centering) ──
  ctx.font = `${EMOJI_PX}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, cx, cy + EMOJI_NUDGE);
}

/** Render a flat pin (no stem) */
function renderPin(color: string, emoji: string, bgFill: string, shape: PinShape): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = HEAD;
  canvas.height = HEAD;
  const ctx = canvas.getContext("2d")!;
  drawPinHead(ctx, HEAD / 2, HEAD / 2, color, emoji, bgFill, shape);
  return ctx.getImageData(0, 0, HEAD, HEAD);
}

/** Render a pin with a gradient stem below (for 3D terrain) */
function renderPinWithStem(color: string, emoji: string, bgFill: string, shape: PinShape): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = HEAD;
  canvas.height = TOTAL_H;
  const ctx = canvas.getContext("2d")!;
  const cx = HEAD / 2;
  const cy = HEAD / 2;

  drawPinHead(ctx, cx, cy, color, emoji, bgFill, shape);

  // Gradient stem
  const stemTop = cy + HEAD / 2;
  const grad = ctx.createLinearGradient(0, stemTop, 0, TOTAL_H);
  grad.addColorStop(0, color + "cc");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(cx - STEM_W / 2, stemTop, STEM_W, TOTAL_H - stemTop);

  return ctx.getImageData(0, 0, HEAD, TOTAL_H);
}

/**
 * Register pin images for every (shape, color, emoji, bgFill) combo.
 *
 * Image keys:
 *   flat:    `pin-{shape}-{bgFill}-{color}-{emoji}`
 *   stemmed: `stem-{shape}-{bgFill}-{color}-{emoji}`
 *
 * Use `icon-size: 0.5` in the symbol layer to display at logical size (2× canvas).
 */
export function registerPinImages(
  map: maplibregl.Map,
  emojis: string[],
  colors: string[],
  bgFill: string = PIN_BG_DARK,
  shape: PinShape = "circle",
) {
  for (const color of colors) {
    for (const emoji of emojis) {
      // Flat pin
      const key = `pin-${shape}-${bgFill}-${color}-${emoji}`;
      if (!map.hasImage(key)) {
        const img = renderPin(color, emoji, bgFill, shape);
        map.addImage(key, { width: HEAD, height: HEAD, data: img.data });
      }
      // Stemmed pin for 3D terrain
      const stemKey = `stem-${shape}-${bgFill}-${color}-${emoji}`;
      if (!map.hasImage(stemKey)) {
        const stemImg = renderPinWithStem(color, emoji, bgFill, shape);
        map.addImage(stemKey, { width: HEAD, height: TOTAL_H, data: stemImg.data });
      }
    }
  }
}
