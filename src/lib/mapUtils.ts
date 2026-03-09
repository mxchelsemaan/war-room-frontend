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
