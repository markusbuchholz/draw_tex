/* Shape library. Every shape is a list of sub-paths in unit coordinates (0..1 box),
 * made of M / L / C (cubic bezier) segments. The same definition is used for
 * canvas drawing, hit-testing, thumbnails and TikZ output, so what you see is what compiles. */
(function (root) {
  const K = 0.5523;
  const poly = (pts, closed = true) => ({ closed, segs: pts.map((p, i) => [i ? 'L' : 'M', p[0], p[1]]) });
  const line = (a, b) => poly([a, b], false);
  const ell = (cx, cy, rx, ry) => ({
    closed: true,
    segs: [['M', cx + rx, cy],
      ['C', cx + rx, cy + K * ry, cx + K * rx, cy + ry, cx, cy + ry],
      ['C', cx - K * rx, cy + ry, cx - rx, cy + K * ry, cx - rx, cy],
      ['C', cx - rx, cy - K * ry, cx - K * rx, cy - ry, cx, cy - ry],
      ['C', cx + K * rx, cy - ry, cx + rx, cy - K * ry, cx + rx, cy]],
  });
  const regular = (n, rot) => poly(Array.from({ length: n }, (_, i) => { const a = rot + (i * 2 * Math.PI) / n; return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]; }));
  const star = () => poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.2 : 0.5; return [0.5 + r * Math.cos(a), 0.54 + r * Math.sin(a) * 0.98]; }));
  // cloud: four round bumps (true circular arcs) on a flat bottom, scaled to fill the unit box
  const cloud = () => {
    const C = [[0.2, 0.64, 0.18], [0.37, 0.4, 0.22], [0.63, 0.36, 0.24], [0.82, 0.64, 0.18]], mid = [0.5, 0.5];
    const cusp = (c1, c2) => {
      const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy), a = (c1[2] * c1[2] - c2[2] * c2[2] + d * d) / (2 * d), h = Math.sqrt(Math.max(0, c1[2] * c1[2] - a * a));
      const px = c1[0] + (a * dx) / d, py = c1[1] + (a * dy) / d, p = [[px + (h * dy) / d, py - (h * dx) / d], [px - (h * dy) / d, py + (h * dx) / d]];
      return Math.hypot(p[0][0] - mid[0], p[0][1] - mid[1]) > Math.hypot(p[1][0] - mid[0], p[1][1] - mid[1]) ? p[0] : p[1];
    };
    const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
    const k12 = cusp(C[0], C[1]), k23 = cusp(C[1], C[2]), k34 = cusp(C[2], C[3]);
    const TAU = 2 * Math.PI, up = (a, from) => { while (a < from) a += TAU; return a; };
    const arcs = [];
    let a0 = Math.PI / 2, a1 = up(ang(C[0], k12), a0); arcs.push([C[0], a0, a1]);
    a0 = ang(C[1], k12); a1 = up(ang(C[1], k23), a0); arcs.push([C[1], a0, a1]);
    a0 = ang(C[2], k23); a1 = up(ang(C[2], k34), a0); arcs.push([C[2], a0, a1]);
    a0 = ang(C[3], k34); a1 = up(Math.PI / 2, a0); arcs.push([C[3], a0, a1]);
    const segs = [];
    arcs.forEach(([c, s, e], i) => {
      const n = Math.ceil((e - s) / (Math.PI / 2) - 1e-9), d = (e - s) / n, k = (4 / 3) * Math.tan(d / 4), r = c[2];
      for (let j = 0; j < n; j++) {
        const t0 = s + j * d, t1 = t0 + d, p0 = [c[0] + r * Math.cos(t0), c[1] + r * Math.sin(t0)], p3 = [c[0] + r * Math.cos(t1), c[1] + r * Math.sin(t1)];
        if (!i && !j) segs.push(['M', p0[0], p0[1]]);
        segs.push(['C', p0[0] - k * r * Math.sin(t0), p0[1] + k * r * Math.cos(t0), p3[0] + k * r * Math.sin(t1), p3[1] - k * r * Math.cos(t1), p3[0], p3[1]]);
      }
    });
    const xs = [], ys = [];
    let cx = 0, cy = 0;
    segs.forEach((g) => { if (g[0] === 'M') { cx = g[1]; cy = g[2]; xs.push(cx); ys.push(cy); } else for (let t = 0; t <= 1; t += 0.1) { const m = 1 - t; xs.push(m * m * m * cx + 3 * m * m * t * g[1] + 3 * m * t * t * g[3] + t * t * t * g[5]); ys.push(m * m * m * cy + 3 * m * m * t * g[2] + 3 * m * t * t * g[4] + t * t * t * g[6]); if (t > 0.95) { cx = g[5]; cy = g[6]; } } });
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { closed: true, segs: segs.map((g) => g.map((v, i) => (i === 0 ? v : i % 2 ? (v - x0) / (x1 - x0) : (v - y0) / (y1 - y0)))) };
  };
  const rrect = () => ({ closed: true, segs: [['M', 0.25, 0], ['L', 0.75, 0], ['C', 0.75 + K * 0.25, 0, 1, 0.5 - K * 0.5, 1, 0.5], ['C', 1, 0.5 + K * 0.5, 0.75 + K * 0.25, 1, 0.75, 1], ['L', 0.25, 1], ['C', 0.25 - K * 0.25, 1, 0, 0.5 + K * 0.5, 0, 0.5], ['C', 0, 0.5 - K * 0.5, 0.25 - K * 0.25, 0, 0.25, 0]] });
  // one closed silhouette (top ellipse back half, sides, bottom front arc) + the front rim of the top ellipse;
  // all sub-paths run clockwise so a fill never cancels out
  const cylinder = () => [
    { closed: true, segs: [['M', 0, 0.12], ['C', 0, 0.12 - K * 0.12, 0.5 - K * 0.5, 0, 0.5, 0], ['C', 0.5 + K * 0.5, 0, 1, 0.12 - K * 0.12, 1, 0.12], ['L', 1, 0.88], ['C', 1, 0.88 + K * 0.12, 0.5 + K * 0.5, 1, 0.5, 1], ['C', 0.5 - K * 0.5, 1, 0, 0.88 + K * 0.12, 0, 0.88]] },
    { closed: false, segs: [['M', 1, 0.12], ['C', 1, 0.12 + K * 0.12, 0.5 + K * 0.5, 0.24, 0.5, 0.24], ['C', 0.5 - K * 0.5, 0.24, 0, 0.12 + K * 0.12, 0, 0.12]] }];
  const semicircle = () => ({ closed: true, segs: [['M', 1, 1], ['C', 1, 1 - K, 0.5 + K * 0.5, 0, 0.5, 0], ['C', 0.5 - K * 0.5, 0, 0, 1 - K, 0, 1], ['L', 1, 1]] });
  const doc = () => ({ closed: true, segs: [['M', 0, 0], ['L', 1, 0], ['L', 1, 0.85], ['C', 0.8, 0.7, 0.7, 1, 0.5, 0.88], ['C', 0.3, 0.76, 0.2, 1, 0, 0.88]] });
  const rect = () => poly([[0, 0], [1, 0], [1, 1], [0, 1]]);
  const diamond = () => poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]);
  const parallelogram = () => poly([[0.2, 0], [1, 0], [0.8, 1], [0, 1]]);
  const hexagon = () => poly([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]]);
  const gate = (body, leads, bubble) => body.concat(leads.map((l) => line(l[0], l[1])), bubble ? [ell(bubble[0], 0.5, bubble[1], 0.075)] : []);
  const andBody = () => [{ closed: true, segs: [['M', 0.2, 0], ['L', 0.5, 0], ['C', 0.85, 0, 0.85, 1, 0.5, 1], ['L', 0.2, 1]] }];
  const orBody = () => [{ closed: true, segs: [['M', 0.2, 0], ['C', 0.5, 0, 0.72, 0.12, 0.82, 0.5], ['C', 0.72, 0.88, 0.5, 1, 0.2, 1], ['C', 0.32, 0.7, 0.32, 0.3, 0.2, 0]] }];

  // elliptical arc as cubic segments (no leading M); angles in radians, clockwise on screen
  const arcSegs = (cx, cy, rx, ry, s, e) => {
    const n = Math.max(1, Math.ceil(Math.abs(e - s) / (Math.PI / 2) - 1e-9)), d = (e - s) / n, k = (4 / 3) * Math.tan(d / 4), out = [];
    for (let j = 0; j < n; j++) {
      const t0 = s + j * d, t1 = t0 + d;
      out.push(['C', cx + rx * Math.cos(t0) - k * rx * Math.sin(t0), cy + ry * Math.sin(t0) + k * ry * Math.cos(t0), cx + rx * Math.cos(t1) + k * rx * Math.sin(t1), cy + ry * Math.sin(t1) - k * ry * Math.cos(t1), cx + rx * Math.cos(t1), cy + ry * Math.sin(t1)]);
    }
    return out;
  };
  const arcPt = (cx, cy, rx, ry, a) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  const P2 = Math.PI * 2;
  const starN = (n, inner, cy = 0.5) => poly(Array.from({ length: 2 * n }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? inner * 0.5 : 0.5; return [0.5 + r * Math.cos(a), cy + r * Math.sin(a)]; }));
  const ring = (ro, ri) => [{ closed: true, segs: [['M', 0.5 + ro, 0.5]].concat(arcSegs(0.5, 0.5, ro, ro, 0, P2)) }, { closed: true, segs: [['M', 0.5 + ri, 0.5]].concat(arcSegs(0.5, 0.5, ri, ri, P2, 0)) }];
  // 3D solids drawn as oblique projections
  const cube = () => { const d = 0.3, x = 1 - d, y = d; return [poly([[0, y], [x, y], [x, 1], [0, 1]]), poly([[0, y], [d, 0], [1, 0], [x, y]]), poly([[x, y], [1, 0], [1, 1 - d], [x, 1]])]; };
  const cuboid = () => [poly([[0, 0.35], [0.7, 0.35], [0.7, 1], [0, 1]]), poly([[0, 0.35], [0.3, 0], [1, 0], [0.7, 0.35]]), poly([[0.7, 0.35], [1, 0], [1, 0.65], [0.7, 1]])];
  const cone = () => [{ closed: true, segs: [['M', 0, 0.88], ['L', 0.5, 0], ['L', 1, 0.88]].concat(arcSegs(0.5, 0.88, 0.5, 0.12, 0, Math.PI)) }, { closed: false, segs: [['M', 0, 0.88]].concat(arcSegs(0.5, 0.88, 0.5, 0.12, Math.PI, P2)) }];
  const sphere = () => [ell(0.5, 0.5, 0.5, 0.5), { closed: false, segs: [['M', 1, 0.5]].concat(arcSegs(0.5, 0.5, 0.5, 0.16, 0, Math.PI)) }, { closed: false, segs: [['M', 0, 0.5]].concat(arcSegs(0.5, 0.5, 0.5, 0.16, Math.PI, P2)) }];
  const hemisphere = () => [{ closed: true, segs: [['M', 0, 0.7]].concat(arcSegs(0.5, 0.7, 0.5, 0.7, Math.PI, P2), arcSegs(0.5, 0.7, 0.5, 0.3, 0, Math.PI)) }, { closed: false, segs: [['M', 0, 0.7]].concat(arcSegs(0.5, 0.7, 0.5, 0.3, Math.PI, P2)) }];
  const pyramid = () => [poly([[0.45, 0], [0, 0.78], [0.55, 1], [1, 0.72]]), line([0.45, 0], [0.55, 1])];
  const prism = () => [poly([[0, 1], [0.6, 1], [1, 0.7], [0.7, 0], [0.3, 0.3]]), poly([[0.3, 0.3], [0.6, 1]], false), poly([[0.6, 1], [0.7, 0]], false)];
  const torus = () => [ell(0.5, 0.5, 0.5, 0.36), { closed: false, segs: [['M', 0.2, 0.5], ['C', 0.3, 0.68, 0.7, 0.68, 0.8, 0.5]] }, { closed: false, segs: [['M', 0.26, 0.55], ['C', 0.36, 0.4, 0.64, 0.4, 0.74, 0.55]] }];
  const axes3d = () => [line([0.35, 0.7], [0.35, 0.03]), poly([[0.31, 0.14], [0.35, 0.02], [0.39, 0.14]], false), line([0.35, 0.7], [0.97, 0.7]), poly([[0.86, 0.66], [0.98, 0.7], [0.86, 0.74]], false), line([0.35, 0.7], [0.04, 0.97]), poly([[0.04, 0.85], [0.03, 0.98], [0.15, 0.95]], false)];
  const rightBrace = () => ({ closed: false, segs: [['M', 0, 0], ['C', 0.4, 0, 0.5, 0.05, 0.5, 0.25], ['L', 0.5, 0.4], ['C', 0.5, 0.47, 0.6, 0.5, 1, 0.5], ['C', 0.6, 0.5, 0.5, 0.53, 0.5, 0.6], ['L', 0.5, 0.75], ['C', 0.5, 0.95, 0.4, 1, 0, 1]] });
  const leftBrace = () => ({ closed: false, segs: [['M', 1, 0], ['C', 0.6, 0, 0.5, 0.05, 0.5, 0.25], ['L', 0.5, 0.4], ['C', 0.5, 0.47, 0.4, 0.5, 0, 0.5], ['C', 0.4, 0.5, 0.5, 0.53, 0.5, 0.6], ['L', 0.5, 0.75], ['C', 0.5, 0.95, 0.6, 1, 1, 1]] });
  const circArrow = () => {
    const s = Math.PI * 0.8, e = Math.PI * 2.1, R = 0.4, r = 0.24, M = 0.32, hw = 0.5, hi = 0.14, tipA = e + 0.5;
    const o = arcPt(0.5, 0.5, R, R, s), ho = arcPt(0.5, 0.5, hw, hw, e), tip = arcPt(0.5, 0.5, M, M, tipA), hn = arcPt(0.5, 0.5, hi, hi, e), ie = arcPt(0.5, 0.5, r, r, e);
    return [{ closed: true, segs: [['M', o[0], o[1]]].concat(arcSegs(0.5, 0.5, R, R, s, e), [['L', ho[0], ho[1]], ['L', tip[0], tip[1]], ['L', hn[0], hn[1]], ['L', ie[0], ie[1]]], arcSegs(0.5, 0.5, r, r, e, s)) }];
  };
  const resistorZ = () => [poly([[0, 0.5], [0.15, 0.5], [0.22, 0.1], [0.34, 0.9], [0.46, 0.1], [0.58, 0.9], [0.7, 0.1], [0.78, 0.5], [1, 0.5]], false)];
  const coil = () => [{ closed: false, segs: [['M', 0, 0.7], ['L', 0.1, 0.7]].concat([0, 1, 2, 3].map((i) => ['C', 0.1 + i * 0.2, 0.0, 0.3 + i * 0.2, 0.0, 0.3 + i * 0.2, 0.7]), [['L', 1, 0.7]]) }];

  // ---- AI / agent icons (all closed sub-paths run clockwise so fills never cancel) ----
  const pl = (pts) => pts.slice(1).map((p, i) => line(pts[i], p)); // open polyline as separate segments (never filled)
  const circ = (cx, cy, r) => ell(cx, cy, r, r);
  const bx = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const rbox = (x0, y0, x1, y1, r) => ({ closed: true, segs: [['M', x0 + r, y0], ['L', x1 - r, y0], ['C', x1 - r + K * r, y0, x1, y0 + r - K * r, x1, y0 + r], ['L', x1, y1 - r], ['C', x1, y1 - r + K * r, x1 - r + K * r, y1, x1 - r, y1], ['L', x0 + r, y1], ['C', x0 + r - K * r, y1, x0, y1 - r + K * r, x0, y1 - r], ['L', x0, y0 + r], ['C', x0, y0 + r - K * r, x0 + r - K * r, y0, x0 + r, y0]] });
  // line between two node centres, trimmed so it stops at the node outlines (radius r)
  const link = (a, b, r) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d; return line([a[0] + ux * r, a[1] + uy * r], [b[0] - ux * r, b[1] - uy * r]); };
  const place = (paths, x, y, w, h) => paths.map((sp) => ({ closed: sp.closed, segs: sp.segs.map((g) => g.map((v, i) => (i === 0 ? v : i % 2 ? x + v * w : y + v * h))) }));
  const spark = (cx, cy, r, inner) => poly(Array.from({ length: 8 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 4, q = i % 2 ? r * inner : r; return [cx + q * Math.cos(a), cy + q * Math.sin(a)]; }));
  const person = (cx, cy, s) => [circ(cx, cy - 0.1 * s, 0.07 * s), { closed: true, segs: [['M', cx - 0.12 * s, cy + 0.12 * s], ['C', cx - 0.12 * s, cy - 0.03 * s, cx + 0.12 * s, cy - 0.03 * s, cx + 0.12 * s, cy + 0.12 * s]] }];
  const netLayers = (L, r) => { const out = []; for (let i = 0; i + 1 < L.length; i++) L[i].forEach((a) => L[i + 1].forEach((b) => out.push(link(a, b, r)))); L.forEach((l) => l.forEach((p) => out.push(circ(p[0], p[1], r)))); return out; };
  const neural = () => netLayers([[[0.12, 0.2], [0.12, 0.5], [0.12, 0.8]], [[0.5, 0.1], [0.5, 0.37], [0.5, 0.63], [0.5, 0.9]], [[0.88, 0.3], [0.88, 0.7]]], 0.07);
  const chip = () => [rbox(0.2, 0.2, 0.8, 0.8, 0.06), bx(0.36, 0.36, 0.64, 0.64)].concat([0.35, 0.5, 0.65].reduce((a, t) => a.concat([line([t, 0.2], [t, 0.06]), line([t, 0.8], [t, 0.94]), line([0.2, t], [0.06, t]), line([0.8, t], [0.94, t])]), []));
  const robot = () => [rbox(0.15, 0.2, 0.85, 0.72, 0.1), line([0.5, 0.2], [0.5, 0.1]), circ(0.5, 0.07, 0.04), circ(0.35, 0.42, 0.07), circ(0.65, 0.42, 0.07), line([0.35, 0.6], [0.65, 0.6]), bx(0.05, 0.36, 0.15, 0.56), bx(0.85, 0.36, 0.95, 0.56), rbox(0.27, 0.76, 0.73, 1, 0.06)];
  const chat = () => [{ closed: true, segs: [['M', 0.12, 0], ['L', 0.88, 0], ['C', 0.88 + K * 0.12, 0, 1, 0.12 - K * 0.12, 1, 0.12], ['L', 1, 0.63], ['C', 1, 0.63 + K * 0.12, 0.88 + K * 0.12, 0.75, 0.88, 0.75], ['L', 0.42, 0.75], ['L', 0.2, 1], ['L', 0.2, 0.75], ['L', 0.12, 0.75], ['C', 0.12 - K * 0.12, 0.75, 0, 0.63 + K * 0.12, 0, 0.63], ['L', 0, 0.12], ['C', 0, 0.12 - K * 0.12, 0.12 - K * 0.12, 0, 0.12, 0]] }, circ(0.3, 0.37, 0.055), circ(0.5, 0.37, 0.055), circ(0.7, 0.37, 0.055)];
  const vectordb = () => cylinder().concat([circ(0.3, 0.58, 0.05), circ(0.58, 0.5, 0.05), circ(0.68, 0.74, 0.05), line([0.35, 0.57], [0.53, 0.51])]);
  const kgraph = () => { const N = [[0.5, 0.14], [0.14, 0.62], [0.86, 0.62], [0.5, 0.52], [0.5, 0.88]], r = 0.09; return [link(N[0], N[1], r), link(N[0], N[2], r), link(N[0], N[3], r), link(N[1], N[3], r), link(N[2], N[3], r), link(N[3], N[4], r), link(N[1], N[4], r), link(N[2], N[4], r)].concat(N.map((p) => circ(p[0], p[1], r))); };
  const search = () => [circ(0.4, 0.4, 0.3), poly([[0.62, 0.72], [0.72, 0.62], [0.96, 0.86], [0.86, 0.96]]), { closed: false, segs: [['M', 0.22, 0.3]].concat(arcSegs(0.4, 0.4, 0.2, 0.2, Math.PI * 1.15, Math.PI * 1.6)) }];
  const docIcon = () => [poly([[0, 0], [0.7, 0], [1, 0.3], [1, 1], [0, 1]]), ...pl([[0.7, 0], [0.7, 0.3], [1, 0.3]]), line([0.2, 0.5], [0.8, 0.5]), line([0.2, 0.65], [0.8, 0.65]), line([0.2, 0.8], [0.6, 0.8]), line([0.2, 0.3], [0.5, 0.3])];
  const gear = () => { const pts = []; for (let k = 0; k < 8; k++) { const t = (k * 45 * Math.PI) / 180, d = (a) => (a * Math.PI) / 180; [[0.37, -11], [0.5, -7], [0.5, 7], [0.37, 11]].forEach(([r, a]) => pts.push([0.5 + r * Math.cos(t + d(a)), 0.5 + r * Math.sin(t + d(a))])); } return [poly(pts), circ(0.5, 0.5, 0.15)]; };
  const eye = () => [{ closed: true, segs: [['M', 0, 0.5], ['C', 0.25, 0.05, 0.75, 0.05, 1, 0.5], ['C', 0.75, 0.95, 0.25, 0.95, 0, 0.5]] }, circ(0.5, 0.5, 0.2), circ(0.5, 0.5, 0.08)];
  const image = () => [rbox(0, 0, 1, 1, 0.06), circ(0.74, 0.3, 0.09), poly([[0.08, 0.88], [0.36, 0.4], [0.56, 0.7], [0.7, 0.54], [0.92, 0.88]])];
  const rlloop = () => [bx(0, 0.25, 0.3, 0.75), bx(0.7, 0.25, 1, 0.75), line([0.3, 0.38], [0.7, 0.38]), ...pl([[0.63, 0.31], [0.7, 0.38], [0.63, 0.45]]), line([0.7, 0.62], [0.3, 0.62]), ...pl([[0.37, 0.55], [0.3, 0.62], [0.37, 0.69]])];
  const memory = () => [bx(0.05, 0.2, 0.95, 0.8), bx(0.15, 0.34, 0.32, 0.66), bx(0.4, 0.34, 0.57, 0.66), bx(0.65, 0.34, 0.82, 0.66)].concat([0.2, 0.35, 0.5, 0.65, 0.8].map((x) => line([x, 0.8], [x, 0.95])));
  const tree = () => { const R = [0.5, 0.14], A = [0.25, 0.5], B = [0.75, 0.5], C = [[0.12, 0.86], [0.38, 0.86], [0.62, 0.86], [0.88, 0.86]], r = 0.08; return [link(R, A, r), link(R, B, r), link(A, C[0], r), link(A, C[1], r), link(B, C[2], r), link(B, C[3], r), circ(R[0], R[1], r), circ(A[0], A[1], r), circ(B[0], B[1], r)].concat(C.map((p) => circ(p[0], p[1], r))); };
  const multiagent = () => person(0.5, 0.22, 1.4).concat(person(0.2, 0.78, 1.4), person(0.8, 0.78, 1.4), [line([0.42, 0.42], [0.28, 0.56]), line([0.58, 0.42], [0.72, 0.56]), line([0.34, 0.86], [0.66, 0.86])]);
  const user = () => person(0.5, 0.5, 3.2);
  const bulb = () => { const cx = 0.5, cy = 0.38, r = 0.34, dx = 0.12, dy = Math.sqrt(r * r - dx * dx), a1 = Math.atan2(dy, -dx), a2 = Math.atan2(dy, dx); return [{ closed: true, segs: [['M', cx - dx, cy + dy]].concat(arcSegs(cx, cy, r, r, a1, a2 + 2 * Math.PI), [['L', 0.6, 0.84], ['L', 0.4, 0.84]]) }, line([0.4, 0.91], [0.6, 0.91]), line([0.44, 0.98], [0.56, 0.98])]; };
  const sparkle = () => [spark(0.42, 0.55, 0.42, 0.24), spark(0.82, 0.18, 0.15, 0.25), spark(0.8, 0.85, 0.1, 0.25)];
  const shield = () => [{ closed: true, segs: [['M', 0.5, 0], ['L', 1, 0.15], ['L', 1, 0.5], ['C', 1, 0.78, 0.75, 0.92, 0.5, 1], ['C', 0.25, 0.92, 0, 0.78, 0, 0.5], ['L', 0, 0.15]] }, ...pl([[0.28, 0.5], [0.45, 0.67], [0.74, 0.34]])];
  const orchestrator = () => { const c = [0.5, 0.5], S = [[0.14, 0.14], [0.86, 0.14], [0.5, 0.9]], r = 0.1; return [rbox(0.36, 0.36, 0.64, 0.64, 0.05)].concat(S.map((p) => link(c, p, 0.2)), S.map((p) => circ(p[0], p[1], r))); };
  const tokens = () => [0, 0.27, 0.54, 0.81].map((x) => bx(x, 0.1, x + 0.19, 0.9));
  const embedding = () => [...pl([[0.3, 0], [0.1, 0], [0.1, 1], [0.3, 1]]), ...pl([[0.7, 0], [0.9, 0], [0.9, 1], [0.7, 1]])].concat([0.2, 0.4, 0.6, 0.8].map((y) => ell(0.5, y, 0.1, 0.06)));
  const hybridrag = () => place(cylinder(), 0.02, 0.1, 0.26, 0.8).concat([line([0.41, 0.5], [0.53, 0.5]), line([0.47, 0.38], [0.47, 0.62])], place(kgraph(), 0.6, 0.1, 0.4, 0.8));
  const tune = () => [0.2, 0.5, 0.8].reduce((a, x, i) => { const y = [0.3, 0.62, 0.45][i]; return a.concat([line([x, 0.08], [x, 0.92]), rbox(x - 0.11, y - 0.07, x + 0.11, y + 0.07, 0.03)]); }, []);
  const terminal = () => [rbox(0, 0.05, 1, 0.95, 0.08), line([0, 0.27], [1, 0.27]), ...pl([[0.14, 0.43], [0.28, 0.55], [0.14, 0.67]]), line([0.38, 0.72], [0.6, 0.72])];
  const codeApi = () => [...pl([[0.3, 0.1], [0.05, 0.5], [0.3, 0.9]]), ...pl([[0.7, 0.1], [0.95, 0.5], [0.7, 0.9]]), line([0.58, 0.05], [0.42, 0.95])];
  const llm = () => [rbox(0.1, 0.05, 0.9, 0.95, 0.08), rbox(0.24, 0.2, 0.76, 0.32, 0.04), rbox(0.24, 0.44, 0.76, 0.56, 0.04), rbox(0.24, 0.68, 0.76, 0.8, 0.04)];

  // curve drawn there and back: strokes like a line but adds no filled area
  const wire = (p0, c1, c2, p1) => ({ closed: false, segs: [['M', p0[0], p0[1]], ['C', c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]], ['C', c2[0], c2[1], c1[0], c1[1], p0[0], p0[1]]] });
  // bumpy brain outline: round bumps along an ellipse (clockwise)
  const brainOutline = () => {
    const N = 11, cx = 0.5, cy = 0.44, rx = 0.43, ry = 0.36, P = [], Nn = [];
    for (let i = 0; i < N; i++) { const a = (i * 2 * Math.PI) / N - Math.PI / 2 + Math.PI / N / 2; P.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); const nx = Math.cos(a) * 0.9, ny = Math.sin(a) * 0.9; Nn.push([nx, ny]); }
    const b = 0.1, segs = [['M', P[0][0], P[0][1]]];
    for (let i = 0; i < N; i++) { const j = (i + 1) % N, m = [(P[i][0] + P[j][0]) / 2 - cx, (P[i][1] + P[j][1]) / 2 - cy], l = Math.hypot(m[0], m[1]) || 1, u = [m[0] / l, m[1] / l]; segs.push(['C', P[i][0] + u[0] * b * 1.3 - (P[j][0] - P[i][0]) * 0.1, P[i][1] + u[1] * b * 1.3 - (P[j][1] - P[i][1]) * 0.1, P[j][0] + u[0] * b * 1.3 + (P[j][0] - P[i][0]) * 0.1, P[j][1] + u[1] * b * 1.3 + (P[j][1] - P[i][1]) * 0.1, P[j][0], P[j][1]]); }
    return { closed: true, segs };
  };
  const brainStem = () => poly([[0.43, 0.78], [0.57, 0.78], [0.55, 0.97], [0.45, 0.97]]);
  const brain = () => [brainOutline(), brainStem(), wire([0.5, 0.1], [0.44, 0.25], [0.56, 0.38], [0.5, 0.62]), wire([0.18, 0.4], [0.28, 0.3], [0.38, 0.5], [0.46, 0.4]), wire([0.82, 0.4], [0.72, 0.3], [0.62, 0.5], [0.54, 0.4]), wire([0.22, 0.62], [0.3, 0.52], [0.38, 0.7], [0.44, 0.6]), wire([0.78, 0.62], [0.7, 0.52], [0.62, 0.7], [0.56, 0.6])];
  const brainAI = () => { const N = [[0.3, 0.3], [0.7, 0.3], [0.5, 0.48], [0.3, 0.64], [0.7, 0.64]], r = 0.045; return [brainOutline(), brainStem()].concat([[0, 2], [1, 2], [2, 3], [2, 4], [0, 3], [1, 4], [0, 1]].map(([a, b]) => link(N[a], N[b], r)), N.map((p) => circ(p[0], p[1], r))); };
  const llmBadge = () => [rbox(0, 0.1, 1, 0.9, 0.12), ...pl([[0.1, 0.3], [0.1, 0.7], [0.26, 0.7]]), ...pl([[0.34, 0.3], [0.34, 0.7], [0.5, 0.7]]), ...pl([[0.6, 0.7], [0.6, 0.3], [0.74, 0.55], [0.88, 0.3], [0.88, 0.7]])];

  const LIB = [
    // id, name, category, default size in px (40 px = 1 cm), builder
    ['diamond', 'Diamond', 'Basic', 120, 80, () => [diamond()]],
    ['triangle', 'Triangle', 'Basic', 100, 80, () => [poly([[0.5, 0], [1, 1], [0, 1]])]],
    ['rtriangle', 'Right triangle', 'Basic', 100, 80, () => [poly([[0, 0], [1, 1], [0, 1]])]],
    ['trapezium', 'Trapezium', 'Basic', 120, 80, () => [poly([[0.2, 0], [0.8, 0], [1, 1], [0, 1]])]],
    ['parallelogram', 'Parallelogram', 'Basic', 120, 80, () => [parallelogram()]],
    ['pentagon', 'Pentagon', 'Basic', 100, 100, () => [regular(5, -Math.PI / 2)]],
    ['hexagon', 'Hexagon', 'Basic', 120, 100, () => [hexagon()]],
    ['octagon', 'Octagon', 'Basic', 100, 100, () => [poly([[0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29]])]],
    ['star', 'Star', 'Basic', 100, 100, () => [star()]],
    ['cross', 'Cross', 'Basic', 100, 100, () => [poly([[0.35, 0], [0.65, 0], [0.65, 0.35], [1, 0.35], [1, 0.65], [0.65, 0.65], [0.65, 1], [0.35, 1], [0.35, 0.65], [0, 0.65], [0, 0.35], [0.35, 0.35]])]],
    ['semicircle', 'Semicircle', 'Basic', 120, 60, () => [semicircle()]],
    ['cloud', 'Cloud', 'Basic', 140, 100, () => [cloud()]],
    ['cylinder', 'Cylinder', 'Basic', 80, 100, cylinder],
    ['callout', 'Speech bubble', 'Basic', 140, 100, () => [poly([[0, 0], [1, 0], [1, 0.75], [0.45, 0.75], [0.25, 1], [0.3, 0.75], [0, 0.75]])]],
    ['heart', 'Heart', 'Basic', 100, 90, () => [{ closed: true, segs: [['M', 0.5, 1], ['C', 0.1, 0.7, 0, 0.45, 0, 0.28], ['C', 0, 0.1, 0.15, 0, 0.28, 0], ['C', 0.4, 0, 0.48, 0.08, 0.5, 0.2], ['C', 0.52, 0.08, 0.6, 0, 0.72, 0], ['C', 0.85, 0, 1, 0.1, 1, 0.28], ['C', 1, 0.45, 0.9, 0.7, 0.5, 1]] }]],
    ['moon', 'Crescent', 'Basic', 70, 100, () => [{ closed: true, segs: [['M', 0.65, 0], ['C', 0.25, 0, 0, 0.25, 0, 0.5], ['C', 0, 0.75, 0.25, 1, 0.65, 1], ['C', 0.4, 0.8, 0.4, 0.2, 0.65, 0]] }]],
    ['bolt', 'Lightning', 'Basic', 70, 100, () => [poly([[0.55, 0], [0.15, 0.55], [0.45, 0.55], [0.3, 1], [0.85, 0.4], [0.55, 0.4], [0.75, 0]])]],
    ['sun', 'Sun', 'Basic', 100, 100, () => [ell(0.5, 0.5, 0.22, 0.22)].concat(Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a); return line([0.5 + 0.32 * c, 0.5 + 0.32 * s], [0.5 + 0.5 * c, 0.5 + 0.5 * s]); }))],
    ['donut', 'Ring', 'Basic', 100, 100, () => ring(0.5, 0.28)],
    ['pie', 'Pie', 'Basic', 100, 100, () => [{ closed: true, segs: [['M', 0.5, 0.5], ['L', 1, 0.5]].concat(arcSegs(0.5, 0.5, 0.5, 0.5, 0, Math.PI * 1.5)) }]],
    ['heptagon', 'Heptagon', 'Basic', 100, 100, () => [regular(7, -Math.PI / 2)]],
    ['decagon', 'Decagon', 'Basic', 100, 100, () => [regular(10, -Math.PI / 2)]],
    ['star4', 'Star (4)', 'Basic', 100, 100, () => [starN(4, 0.4)]],
    ['star6', 'Star (6)', 'Basic', 100, 100, () => [starN(6, 0.55)]],
    ['star8', 'Star (8)', 'Basic', 100, 100, () => [starN(8, 0.7)]],
    ['frame', 'Frame', 'Basic', 120, 90, () => [poly([[0, 0], [1, 0], [1, 1], [0, 1]]), poly([[0.14, 0.16], [0.14, 0.84], [0.86, 0.84], [0.86, 0.16]])]],
    ['lshape', 'L-shape', 'Basic', 100, 100, () => [poly([[0, 0], [0.4, 0], [0.4, 0.6], [1, 0.6], [1, 1], [0, 1]])]],
    ['check', 'Check mark', 'Basic', 80, 80, () => [poly([[0, 0.55], [0.15, 0.4], [0.38, 0.65], [0.85, 0.05], [1, 0.2], [0.38, 0.95]])]],
    ['xmark', 'Cross mark', 'Basic', 80, 80, () => [poly([[0.2, 0], [0.5, 0.3], [0.8, 0], [1, 0.2], [0.7, 0.5], [1, 0.8], [0.8, 1], [0.5, 0.7], [0.2, 1], [0, 0.8], [0.3, 0.5], [0, 0.2]])]],
    ['smiley', 'Smiley', 'Basic', 90, 90, () => [ell(0.5, 0.5, 0.5, 0.5), ell(0.33, 0.38, 0.05, 0.07), ell(0.67, 0.38, 0.05, 0.07), { closed: false, segs: [['M', 0.25, 0.62], ['C', 0.35, 0.86, 0.65, 0.86, 0.75, 0.62]] }]],
    ['prohibit', 'Prohibited', 'Basic', 90, 90, () => [ell(0.5, 0.5, 0.5, 0.5), line([0.15, 0.15], [0.85, 0.85])]],
    ['rbrace', 'Brace }', 'Basic', 40, 120, () => [rightBrace()]],
    ['lbrace', 'Brace {', 'Basic', 40, 120, () => [leftBrace()]],
    ['bracket', 'Bracket [', 'Basic', 40, 120, () => [poly([[1, 0], [0, 0], [0, 1], [1, 1]], false)]],
    ['rbracket', 'Bracket ]', 'Basic', 40, 120, () => [poly([[0, 0], [1, 0], [1, 1], [0, 1]], false)]],
    ['cube', 'Cube', '3D', 100, 100, () => cube()],
    ['cuboid', 'Cuboid / box', '3D', 140, 100, cuboid],
    ['cyl3d', 'Cylinder', '3D', 80, 110, cylinder],
    ['cone3d', 'Cone', '3D', 90, 110, cone],
    ['sphere', 'Sphere', '3D', 100, 100, sphere],
    ['hemisphere', 'Hemisphere', '3D', 110, 80, hemisphere],
    ['pyramid', 'Pyramid', '3D', 110, 100, pyramid],
    ['prism', 'Triangular prism', '3D', 130, 100, prism],
    ['torus', 'Torus', '3D', 130, 90, torus],
    ['axes3d', '3D axes', '3D', 110, 110, axes3d],
    ['brain', 'Brain', 'AI / Agents', 100, 100, brain],
    ['brainai', 'AI brain (network)', 'AI / Agents', 100, 100, brainAI],
    ['llmbadge', 'LLM (badge)', 'AI / Agents', 120, 60, llmBadge],
    ['llm', 'LLM (layers)', 'AI / Agents', 90, 100, llm],
    ['agent', 'AI agent (robot)', 'AI / Agents', 90, 110, robot],
    ['multiagent', 'Multi-agent', 'AI / Agents', 110, 100, multiagent],
    ['user', 'User / human', 'AI / Agents', 70, 80, user],
    ['neural', 'Neural network', 'AI / Agents', 120, 100, neural],
    ['chip', 'Chip / GPU', 'AI / Agents', 90, 90, chip],
    ['chat', 'Chat / prompt', 'AI / Agents', 120, 100, chat],
    ['terminal', 'Terminal prompt', 'AI / Agents', 120, 90, terminal],
    ['codeapi', 'Code / API', 'AI / Agents', 100, 60, codeApi],
    ['tokens', 'Tokens', 'AI / Agents', 140, 40, tokens],
    ['embedding', 'Embedding vector', 'AI / Agents', 60, 100, embedding],
    ['vectordb', 'Vector DB', 'AI / Agents', 80, 100, vectordb],
    ['kgraph', 'Knowledge graph', 'AI / Agents', 110, 100, kgraph],
    ['retriever', 'Retriever (search)', 'AI / Agents', 90, 90, search],
    ['aidoc', 'Document', 'AI / Agents', 80, 100, docIcon],
    ['hybridrag', 'Hybrid RAG', 'AI / Agents', 180, 100, hybridrag],
    ['memory', 'Memory', 'AI / Agents', 100, 80, memory],
    ['planner', 'Planner (tree)', 'AI / Agents', 110, 100, tree],
    ['orchestrator', 'Orchestrator', 'AI / Agents', 110, 100, orchestrator],
    ['tool', 'Tool (gear)', 'AI / Agents', 90, 90, gear],
    ['vision', 'Vision (eye)', 'AI / Agents', 100, 70, eye],
    ['vlmimage', 'Image (VLM)', 'AI / Agents', 100, 80, image],
    ['rlloop', 'RL loop (agent ↔ env)', 'AI / Agents', 150, 80, rlloop],
    ['tune', 'Fine-tuning', 'AI / Agents', 80, 80, tune],
    ['idea', 'Reasoning (bulb)', 'AI / Agents', 70, 100, bulb],
    ['sparkle', 'AI sparkle', 'AI / Agents', 90, 90, sparkle],
    ['guardrail', 'Guardrails', 'AI / Agents', 80, 100, shield],
    ['arrowR', 'Arrow right', 'Arrows', 140, 60, () => [poly([[0, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0, 0.75]])]],
    ['arrowL', 'Arrow left', 'Arrows', 140, 60, () => [poly([[1, 0.25], [0.4, 0.25], [0.4, 0], [0, 0.5], [0.4, 1], [0.4, 0.75], [1, 0.75]])]],
    ['arrowU', 'Arrow up', 'Arrows', 60, 140, () => [poly([[0.25, 1], [0.25, 0.4], [0, 0.4], [0.5, 0], [1, 0.4], [0.75, 0.4], [0.75, 1]])]],
    ['arrowD', 'Arrow down', 'Arrows', 60, 140, () => [poly([[0.25, 0], [0.25, 0.6], [0, 0.6], [0.5, 1], [1, 0.6], [0.75, 0.6], [0.75, 0]])]],
    ['darrowH', 'Double arrow', 'Arrows', 160, 60, () => [poly([[0, 0.5], [0.2, 0], [0.2, 0.3], [0.8, 0.3], [0.8, 0], [1, 0.5], [0.8, 1], [0.8, 0.7], [0.2, 0.7], [0.2, 1]])]],
    ['chevron', 'Chevron', 'Arrows', 120, 60, () => [poly([[0, 0], [0.7, 0], [1, 0.5], [0.7, 1], [0, 1], [0.3, 0.5]])]],
    ['homeplate', 'Pentagon arrow', 'Arrows', 140, 60, () => [poly([[0, 0], [0.7, 0], [1, 0.5], [0.7, 1], [0, 1]])]],
    ['darrowV', 'Double arrow (vertical)', 'Arrows', 60, 160, () => [poly([[0.5, 0], [1, 0.2], [0.7, 0.2], [0.7, 0.8], [1, 0.8], [0.5, 1], [0, 0.8], [0.3, 0.8], [0.3, 0.2], [0, 0.2]])]],
    ['arrow4', 'Four-way arrow', 'Arrows', 110, 110, () => [poly([[0.5, 0], [0.7, 0.2], [0.58, 0.2], [0.58, 0.42], [0.8, 0.42], [0.8, 0.3], [1, 0.5], [0.8, 0.7], [0.8, 0.58], [0.58, 0.58], [0.58, 0.8], [0.7, 0.8], [0.5, 1], [0.3, 0.8], [0.42, 0.8], [0.42, 0.58], [0.2, 0.58], [0.2, 0.7], [0, 0.5], [0.2, 0.3], [0.2, 0.42], [0.42, 0.42], [0.42, 0.2], [0.3, 0.2]])]],
    ['elbowArrow', 'Elbow arrow', 'Arrows', 110, 100, () => [poly([[0, 1], [0, 0.25], [0.62, 0.25], [0.62, 0], [1, 0.375], [0.62, 0.75], [0.62, 0.5], [0.25, 0.5], [0.25, 1]])]],
    ['circArrow', 'Circular arrow', 'Arrows', 100, 100, circArrow],
    ['notchArrow', 'Notched arrow', 'Arrows', 140, 60, () => [poly([[0, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0, 0.75], [0.15, 0.5]])]],
    ['stripeArrow', 'Striped arrow', 'Arrows', 140, 60, () => [poly([[0.3, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0.3, 0.75]]), poly([[0, 0.25], [0.1, 0.25], [0.1, 0.75], [0, 0.75]]), poly([[0.15, 0.25], [0.25, 0.25], [0.25, 0.75], [0.15, 0.75]])]],
    ['calloutArrow', 'Arrow callout', 'Arrows', 140, 70, () => [poly([[0, 0], [0.55, 0], [0.55, 0.2], [0.75, 0.2], [0.75, 0], [1, 0.5], [0.75, 1], [0.75, 0.8], [0.55, 0.8], [0.55, 1], [0, 1]])]],
    ['process', 'Process', 'Flowchart', 120, 60, () => [rect()]],
    ['decision', 'Decision', 'Flowchart', 120, 80, () => [diamond()]],
    ['terminator', 'Start / End', 'Flowchart', 120, 60, () => [rrect()]],
    ['data', 'Input / Output', 'Flowchart', 120, 60, () => [parallelogram()]],
    ['document', 'Document', 'Flowchart', 120, 80, () => [doc()]],
    ['predefined', 'Predefined process', 'Flowchart', 120, 60, () => [rect(), line([0.12, 0], [0.12, 1]), line([0.88, 0], [0.88, 1])]],
    ['preparation', 'Preparation', 'Flowchart', 120, 60, () => [hexagon()]],
    ['connector', 'Connector', 'Flowchart', 40, 40, () => [ell(0.5, 0.5, 0.5, 0.5)]],
    ['database', 'Database', 'Flowchart', 80, 100, cylinder],
    ['manual', 'Manual input', 'Flowchart', 120, 60, () => [poly([[0, 0.2], [1, 0], [1, 1], [0, 1]])]],
    ['delay', 'Delay', 'Flowchart', 120, 60, () => [{ closed: true, segs: [['M', 0, 0], ['L', 0.55, 0], ['C', 0.55 + K * 0.45, 0, 1, 0.5 - K * 0.5, 1, 0.5], ['C', 1, 0.5 + K * 0.5, 0.55 + K * 0.45, 1, 0.55, 1], ['L', 0, 1]] }]],
    ['merge', 'Merge', 'Flowchart', 80, 70, () => [poly([[0, 0], [1, 0], [0.5, 1]])]],
    ['extract', 'Extract', 'Flowchart', 80, 70, () => [poly([[0.5, 0], [1, 1], [0, 1]])]],
    ['sort', 'Sort', 'Flowchart', 80, 80, () => [diamond(), line([0, 0.5], [1, 0.5])]],
    ['sumjunction', 'Summing junction', 'Flowchart', 60, 60, () => [ell(0.5, 0.5, 0.5, 0.5), line([0.15, 0.15], [0.85, 0.85]), line([0.85, 0.15], [0.15, 0.85])]],
    ['orjunction', 'Or junction', 'Flowchart', 60, 60, () => [ell(0.5, 0.5, 0.5, 0.5), line([0.5, 0], [0.5, 1]), line([0, 0.5], [1, 0.5])]],
    ['offpage', 'Off-page connector', 'Flowchart', 60, 70, () => [poly([[0, 0], [1, 0], [1, 0.65], [0.5, 1], [0, 0.65]])]],
    ['display', 'Display', 'Flowchart', 120, 60, () => [{ closed: true, segs: [['M', 0, 0.5], ['L', 0.18, 0], ['L', 0.8, 0], ['C', 0.8 + K * 0.2, 0, 1, 0.5 - K * 0.5, 1, 0.5], ['C', 1, 0.5 + K * 0.5, 0.8 + K * 0.2, 1, 0.8, 1], ['L', 0.18, 1]] }]],
    ['storeddata', 'Stored data', 'Flowchart', 120, 60, () => [{ closed: true, segs: [['M', 0.12, 0], ['L', 1, 0], ['C', 0.9, 0.25, 0.9, 0.75, 1, 1], ['L', 0.12, 1], ['C', 0.02, 0.75, 0.02, 0.25, 0.12, 0]] }]],
    ['actor', 'Actor', 'Diagram / UML', 60, 120, () => [ell(0.5, 0.12, 0.22, 0.11), line([0.5, 0.23], [0.5, 0.62]), line([0.12, 0.38], [0.88, 0.38]), line([0.5, 0.62], [0.12, 1]), line([0.5, 0.62], [0.88, 1])]],
    ['umlclass', 'Class box', 'Diagram / UML', 140, 120, () => [rect(), line([0, 0.3], [1, 0.3]), line([0, 0.65], [1, 0.65])]],
    ['note', 'Note', 'Diagram / UML', 120, 80, () => [poly([[0, 0], [0.78, 0], [1, 0.22], [1, 1], [0, 1]]), poly([[0.78, 0], [0.78, 0.22], [1, 0.22]], false)]],
    ['package', 'Package', 'Diagram / UML', 140, 100, () => [poly([[0, 0], [0.4, 0], [0.4, 0.15], [1, 0.15], [1, 1], [0, 1]])]],
    ['usecase', 'Use case', 'Diagram / UML', 140, 70, () => [ell(0.5, 0.5, 0.5, 0.5)]],
    ['finalstate', 'Final state', 'Diagram / UML', 50, 50, () => [ell(0.5, 0.5, 0.5, 0.5), ell(0.5, 0.5, 0.28, 0.28)]],
    ['component', 'Component', 'Diagram / UML', 140, 90, () => [poly([[0.08, 0], [1, 0], [1, 1], [0.08, 1]]), poly([[0, 0.2], [0.16, 0.2], [0.16, 0.4], [0, 0.4]]), poly([[0, 0.6], [0.16, 0.6], [0.16, 0.8], [0, 0.8]])]],
    ['interface', 'Interface (lollipop)', 'Diagram / UML', 80, 40, () => [line([0, 0.5], [0.5, 0.5]), ell(0.75, 0.5, 0.25, 0.5)]],
    ['lifeline', 'Lifeline', 'Diagram / UML', 90, 150, () => [poly([[0, 0], [1, 0], [1, 0.16], [0, 0.16]]), line([0.5, 0.16], [0.5, 1])]],
    ['and', 'AND gate', 'Logic gates', 120, 80, () => gate(andBody(), [[[0, 0.3], [0.2, 0.3]], [[0, 0.7], [0.2, 0.7]], [[0.76, 0.5], [1, 0.5]]])],
    ['or', 'OR gate', 'Logic gates', 120, 80, () => gate(orBody(), [[[0, 0.3], [0.29, 0.3]], [[0, 0.7], [0.29, 0.7]], [[0.82, 0.5], [1, 0.5]]])],
    ['not', 'NOT gate', 'Logic gates', 120, 60, () => gate([poly([[0.2, 0.05], [0.2, 0.95], [0.72, 0.5]])], [[[0, 0.5], [0.2, 0.5]], [[0.82, 0.5], [1, 0.5]]], [0.77, 0.05])],
    ['nand', 'NAND gate', 'Logic gates', 120, 80, () => gate(andBody(), [[[0, 0.3], [0.2, 0.3]], [[0, 0.7], [0.2, 0.7]], [[0.82, 0.5], [1, 0.5]]], [0.79, 0.04])],
    ['nor', 'NOR gate', 'Logic gates', 120, 80, () => gate(orBody(), [[[0, 0.3], [0.29, 0.3]], [[0, 0.7], [0.29, 0.7]], [[0.87, 0.5], [1, 0.5]]], [0.845, 0.035])],
    ['xor', 'XOR gate', 'Logic gates', 120, 80, () => gate(orBody().concat([{ closed: false, segs: [['M', 0.13, 0], ['C', 0.25, 0.3, 0.25, 0.7, 0.13, 1]] }]), [[[0, 0.3], [0.22, 0.3]], [[0, 0.7], [0.22, 0.7]], [[0.82, 0.5], [1, 0.5]]])],
    ['xnor', 'XNOR gate', 'Logic gates', 120, 80, () => gate(orBody().concat([{ closed: false, segs: [['M', 0.13, 0], ['C', 0.25, 0.3, 0.25, 0.7, 0.13, 1]] }]), [[[0, 0.3], [0.22, 0.3]], [[0, 0.7], [0.22, 0.7]], [[0.87, 0.5], [1, 0.5]]], [0.845, 0.035])],
    ['buffer', 'Buffer', 'Logic gates', 120, 60, () => gate([poly([[0.2, 0.05], [0.2, 0.95], [0.82, 0.5]])], [[[0, 0.5], [0.2, 0.5]], [[0.82, 0.5], [1, 0.5]]])],
    ['resistor', 'Resistor', 'Electronics', 120, 40, () => [line([0, 0.5], [0.2, 0.5]), poly([[0.2, 0.1], [0.8, 0.1], [0.8, 0.9], [0.2, 0.9]]), line([0.8, 0.5], [1, 0.5])]],
    ['resistorz', 'Resistor (zigzag)', 'Electronics', 120, 40, resistorZ],
    ['capacitor', 'Capacitor', 'Electronics', 80, 60, () => [line([0, 0.5], [0.42, 0.5]), line([0.42, 0.05], [0.42, 0.95]), line([0.58, 0.05], [0.58, 0.95]), line([0.58, 0.5], [1, 0.5])]],
    ['inductor', 'Inductor', 'Electronics', 140, 40, coil],
    ['battery', 'Battery', 'Electronics', 80, 60, () => [line([0, 0.5], [0.4, 0.5]), line([0.4, 0.05], [0.4, 0.95]), line([0.6, 0.25], [0.6, 0.75]), line([0.6, 0.5], [1, 0.5])]],
    ['diode', 'Diode', 'Electronics', 100, 50, () => [line([0, 0.5], [0.25, 0.5]), poly([[0.25, 0.1], [0.25, 0.9], [0.7, 0.5]]), line([0.7, 0.1], [0.7, 0.9]), line([0.7, 0.5], [1, 0.5])]],
    ['lamp', 'Lamp', 'Electronics', 90, 50, () => [line([0, 0.5], [0.2, 0.5]), ell(0.5, 0.5, 0.3, 0.5), line([0.29, 0.15], [0.71, 0.85]), line([0.71, 0.15], [0.29, 0.85]), line([0.8, 0.5], [1, 0.5])]],
    ['source', 'Voltage source', 'Electronics', 90, 50, () => [line([0, 0.5], [0.2, 0.5]), ell(0.5, 0.5, 0.3, 0.5), line([0.8, 0.5], [1, 0.5])]],
    ['switch', 'Switch', 'Electronics', 100, 40, () => [line([0, 0.8], [0.25, 0.8]), line([0.25, 0.8], [0.78, 0.15]), line([0.75, 0.8], [1, 0.8])]],
    ['ground', 'Ground', 'Electronics', 50, 50, () => [line([0.5, 0], [0.5, 0.4]), line([0, 0.4], [1, 0.4]), line([0.2, 0.7], [0.8, 0.7]), line([0.4, 1], [0.6, 1])]],
  ].map(([id, name, cat, w, h, build]) => ({ id, name, cat, w, h, build }));

  const BY_ID = {}; LIB.forEach((l) => (BY_ID[l.id] = l));
  const CATS = Array.from(new Set(LIB.map((l) => l.cat)));

  // sub-paths scaled to the shape's box (world px)
  function paths(s, box) {
    const b = box || s, def = BY_ID[s.kind]; if (!def) return [];
    return def.build().map((sp) => ({
      closed: sp.closed,
      segs: sp.segs.map((g) => { const o = [g[0]]; for (let i = 1; i < g.length; i += 2) o.push(b.x + g[i] * b.w, b.y + g[i + 1] * b.h); return o; }),
    }));
  }
  // flattened polylines (for hit testing)
  function flat(s) {
    return paths(s).map((sp) => {
      const pts = []; let cx = 0, cy = 0;
      sp.segs.forEach((g) => {
        if (g[0] === 'C') { for (let i = 1; i <= 12; i++) { const t = i / 12, m = 1 - t; pts.push({ x: m * m * m * cx + 3 * m * m * t * g[1] + 3 * m * t * t * g[3] + t * t * t * g[5], y: m * m * m * cy + 3 * m * m * t * g[2] + 3 * m * t * t * g[4] + t * t * t * g[6] }); } cx = g[5]; cy = g[6]; }
        else { pts.push({ x: g[1], y: g[2] }); cx = g[1]; cy = g[2]; }
      });
      return { closed: sp.closed, pts };
    });
  }
  // TikZ path text; P formats a {x,y} world point
  function tikz(s, P) {
    return paths(s).map((sp) => {
      let out = '';
      sp.segs.forEach((g) => {
        if (g[0] === 'M') out += (out ? ' ' : '') + P({ x: g[1], y: g[2] });
        else if (g[0] === 'L') out += ' -- ' + P({ x: g[1], y: g[2] });
        else out += ` .. controls ${P({ x: g[1], y: g[2] })} and ${P({ x: g[3], y: g[4] })} .. ${P({ x: g[5], y: g[6] })}`;
      });
      return out + (sp.closed ? ' -- cycle' : '');
    }).join(' ');
  }
  const api = { LIB, CATS, BY_ID, paths, flat, tikz };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shapes = api;
})(typeof window !== 'undefined' ? window : globalThis);
