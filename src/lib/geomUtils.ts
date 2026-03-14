// Returns the arrowhead triangle polygon + the base-center point (body ends here)
export function computeArrowhead(
  coords: [number, number][],
  widthScale = 2,
): { polygon: [number, number][]; base: [number, number] } | null {
  if (coords.length < 2) return null;
  const tip  = coords[coords.length - 1];
  const prev = coords[coords.length - 2];
  const dx = tip[0] - prev[0];
  const dy = tip[1] - prev[1];
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1e-10) return null;

  const scale = Math.max(0.4, widthScale / 3);
  const hl = Math.min(Math.max(L * 0.15, 0.003), 0.009) * scale;
  const hw = hl * 0.7;

  const ux = dx / L, uy = dy / L;
  const px = -uy,    py =  ux;

  const bx = tip[0] - ux * hl;
  const by = tip[1] - uy * hl;

  return {
    polygon: [tip, [bx + px * hw, by + py * hw], [bx - px * hw, by - py * hw], tip],
    base: [bx, by],
  };
}

// Broad (jagged-tail) arrow: filled polygon with V-notch tail and pointed head
export function computeJaggedArrowPolygon(
  coords: [number, number][],
  halfWidth: number,
): [number, number][] | null {
  const n = coords.length;
  if (n < 2) return null;

  // Per-segment forward directions and left normals
  const segFwd: [number, number][] = [];
  const segNorm: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = coords[i+1][0] - coords[i][0];
    const dy = coords[i+1][1] - coords[i][1];
    const L = Math.sqrt(dx*dx + dy*dy);
    if (L < 1e-12) { segFwd.push([1,0]); segNorm.push([0,1]); continue; }
    segFwd.push([dx/L, dy/L]);
    segNorm.push([-dy/L, dx/L]);
  }

  // Per-vertex miter normals for body vertices (0..n-2)
  const vertNorm: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    if (i === 0) {
      vertNorm.push(segNorm[0]);
    } else {
      let nx = segNorm[i-1][0] + segNorm[i][0];
      let ny = segNorm[i-1][1] + segNorm[i][1];
      const L = Math.sqrt(nx*nx + ny*ny);
      if (L > 1e-10) { nx /= L; ny /= L; }
      vertNorm.push([nx, ny]);
    }
  }

  // Head geometry based on last segment
  const lastFwd = segFwd[n-2];
  const lastNorm = segNorm[n-2];
  const tip = coords[n-1];
  const lastBodyPt = coords[n-2];
  const lastSegLen = Math.sqrt((tip[0]-lastBodyPt[0])**2 + (tip[1]-lastBodyPt[1])**2);

  const headHW = halfWidth * 2.0;
  const hl = Math.min(halfWidth * 4.0, lastSegLen * 0.7);
  const headBase: [number, number] = [tip[0] - lastFwd[0]*hl, tip[1] - lastFwd[1]*hl];
  const headLeft:  [number, number] = [headBase[0] + lastNorm[0]*headHW, headBase[1] + lastNorm[1]*headHW];
  const headRight: [number, number] = [headBase[0] - lastNorm[0]*headHW, headBase[1] - lastNorm[1]*headHW];

  // Body left/right offsets for all body vertices (0..n-2)
  const bodyL: [number, number][] = [];
  const bodyR: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const [nx, ny] = vertNorm[i];
    bodyL.push([coords[i][0] + nx*halfWidth, coords[i][1] + ny*halfWidth]);
    bodyR.push([coords[i][0] - nx*halfWidth, coords[i][1] - ny*halfWidth]);
  }

  // V-notch at tail: a point pushed forward into the body
  const tailFwd = segFwd[0];
  const notchDepth = halfWidth * 1.5;
  const notchPt: [number, number] = [
    coords[0][0] + tailFwd[0]*notchDepth,
    coords[0][1] + tailFwd[1]*notchDepth,
  ];

  // Build polygon: left side → head → tip → right side reversed → notch → close
  return [
    ...bodyL.slice(0, n-2),
    bodyL[n-2],
    headLeft,
    tip,
    headRight,
    bodyR[n-2],
    ...[...bodyR.slice(0, n-2)].reverse(),
    notchPt,
    bodyL[0],
  ];
}
