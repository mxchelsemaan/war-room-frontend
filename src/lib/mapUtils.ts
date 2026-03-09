import maplibregl from "maplibre-gl";

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

/** Track emojis already registered across all calls */
const _registeredEmojis = new Set<string>();

/** Render each unique emoji to a canvas and register as a MapLibre image */
export function registerEmojiImages(map: maplibregl.Map, emojis: string[]) {
  // Fast path: skip entirely if all emojis are already registered
  if (emojis.every((e) => _registeredEmojis.has(e))) return;

  for (const emoji of emojis) {
    if (_registeredEmojis.has(emoji)) continue;
    const key = `emoji-${emoji}`;
    if (map.hasImage(key)) {
      _registeredEmojis.add(emoji);
      continue;
    }
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
    _registeredEmojis.add(emoji);
  }
}

// ── Pin marker images ────────────────────────────────────────────────────────

const _registeredPins = new Set<string>();

const PIN_W = 44;
const PIN_H = 56;
const CIRCLE_R = 18;
const CIRCLE_CY = 20;
const TIP_Y = PIN_H - 2;
const DARK = "#0f172a";

/** Render a pin image: circle with colored border + downward pointer + emoji */
function renderPinImage(color: string, emoji: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = PIN_W;
  canvas.height = PIN_H;
  const ctx = canvas.getContext("2d")!;
  const cx = PIN_W / 2;

  // Colored glow
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.restore();

  // Pin tip (triangle)
  ctx.beginPath();
  ctx.moveTo(cx - 8, CIRCLE_CY + CIRCLE_R - 4);
  ctx.lineTo(cx, TIP_Y);
  ctx.lineTo(cx + 8, CIRCLE_CY + CIRCLE_R - 4);
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Main circle (on top of triangle base)
  ctx.beginPath();
  ctx.arc(cx, CIRCLE_CY, CIRCLE_R, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Emoji
  ctx.font = "20px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, cx, CIRCLE_CY);

  return ctx.getImageData(0, 0, PIN_W, PIN_H);
}

/** Register pin images for every (color, emoji) combo that hasn't been registered yet */
export function registerPinImages(
  map: maplibregl.Map,
  emojis: string[],
  colors: string[],
) {
  for (const color of colors) {
    for (const emoji of emojis) {
      const key = `pin-${color}-${emoji}`;
      if (_registeredPins.has(key)) continue;
      if (map.hasImage(key)) {
        _registeredPins.add(key);
        continue;
      }
      const img = renderPinImage(color, emoji);
      map.addImage(key, { width: PIN_W, height: PIN_H, data: img.data });
      _registeredPins.add(key);
    }
  }
}
