// Shared Catmull-Rom spline with arc-length parameterization

export function crPoint(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number],
  t: number,
): [number, number] {
  const t2 = t * t, t3 = t2 * t;
  return [
    0.5*(2*p1[0]+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
    0.5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
  ];
}

export function buildSpline(
  coords: [number, number][],
  nSamples = 800,
): [number, number][] {
  const ext: [number, number][] = [coords[0], ...coords, coords[coords.length - 1]];
  const segs = coords.length - 1;
  const perSeg = Math.ceil(nSamples / segs);
  const pts: [number, number][] = [];
  for (let s = 0; s < segs; s++) {
    for (let i = 0; i < perSeg; i++) pts.push(crPoint(ext[s], ext[s+1], ext[s+2], ext[s+3], i/perSeg));
  }
  pts.push(coords[coords.length - 1]);
  return pts;
}

export function buildArc(pts: [number, number][]): number[] {
  const a = [0];
  for (let i = 1; i < pts.length; i++) a.push(a[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]));
  return a;
}

export function getState(
  pts: [number, number][],
  arc: number[],
  t: number,
  lookAhead = 14,
): { pos: [number, number]; bearing: number; idx: number } {
  const d = t * arc[arc.length - 1];
  let lo = 0, hi = arc.length - 1;
  while (lo < hi - 1) { const m = (lo+hi)>>1; if (arc[m] <= d) lo = m; else hi = m; }
  const lt = (arc[hi]-arc[lo]) > 0 ? (d-arc[lo])/(arc[hi]-arc[lo]) : 0;
  const a = pts[lo], b = pts[hi];
  const pos: [number, number] = [a[0]+(b[0]-a[0])*lt, a[1]+(b[1]-a[1])*lt];
  const fwd = pts[Math.min(lo+lookAhead, pts.length-1)];
  const bearing = ((Math.atan2(fwd[0]-a[0], fwd[1]-a[1]) * 180/Math.PI) + 360) % 360;
  return { pos, bearing, idx: lo };
}
