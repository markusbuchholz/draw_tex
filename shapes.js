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
  const cylinder = () => [
    { closed: false, segs: [['M', 0, 0.12], ['L', 0, 0.88], ['C', 0, 0.88 + K * 0.12, 0.5 - K * 0.5, 1, 0.5, 1], ['C', 0.5 + K * 0.5, 1, 1, 0.88 + K * 0.12, 1, 0.88], ['L', 1, 0.12]] },
    ell(0.5, 0.12, 0.5, 0.12)];
  const semicircle = () => ({ closed: true, segs: [['M', 1, 1], ['C', 1, 1 - K, 0.5 + K * 0.5, 0, 0.5, 0], ['C', 0.5 - K * 0.5, 0, 0, 1 - K, 0, 1], ['L', 1, 1]] });
  const doc = () => ({ closed: true, segs: [['M', 0, 0], ['L', 1, 0], ['L', 1, 0.85], ['C', 0.8, 0.7, 0.7, 1, 0.5, 0.88], ['C', 0.3, 0.76, 0.2, 1, 0, 0.88]] });
  const rect = () => poly([[0, 0], [1, 0], [1, 1], [0, 1]]);
  const diamond = () => poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]);
  const parallelogram = () => poly([[0.2, 0], [1, 0], [0.8, 1], [0, 1]]);
  const hexagon = () => poly([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]]);
  const gate = (body, leads, bubble) => body.concat(leads.map((l) => line(l[0], l[1])), bubble ? [ell(bubble[0], 0.5, bubble[1], 0.075)] : []);
  const andBody = () => [{ closed: true, segs: [['M', 0.2, 0], ['L', 0.5, 0], ['C', 0.85, 0, 0.85, 1, 0.5, 1], ['L', 0.2, 1]] }];
  const orBody = () => [{ closed: true, segs: [['M', 0.2, 0], ['C', 0.5, 0, 0.72, 0.12, 0.82, 0.5], ['C', 0.72, 0.88, 0.5, 1, 0.2, 1], ['C', 0.32, 0.7, 0.32, 0.3, 0.2, 0]] }];

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
    ['arrowR', 'Arrow right', 'Arrows', 140, 60, () => [poly([[0, 0.25], [0.6, 0.25], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.75], [0, 0.75]])]],
    ['arrowL', 'Arrow left', 'Arrows', 140, 60, () => [poly([[1, 0.25], [0.4, 0.25], [0.4, 0], [0, 0.5], [0.4, 1], [0.4, 0.75], [1, 0.75]])]],
    ['arrowU', 'Arrow up', 'Arrows', 60, 140, () => [poly([[0.25, 1], [0.25, 0.4], [0, 0.4], [0.5, 0], [1, 0.4], [0.75, 0.4], [0.75, 1]])]],
    ['arrowD', 'Arrow down', 'Arrows', 60, 140, () => [poly([[0.25, 0], [0.25, 0.6], [0, 0.6], [0.5, 1], [1, 0.6], [0.75, 0.6], [0.75, 0]])]],
    ['darrowH', 'Double arrow', 'Arrows', 160, 60, () => [poly([[0, 0.5], [0.2, 0], [0.2, 0.3], [0.8, 0.3], [0.8, 0], [1, 0.5], [0.8, 1], [0.8, 0.7], [0.2, 0.7], [0.2, 1]])]],
    ['chevron', 'Chevron', 'Arrows', 120, 60, () => [poly([[0, 0], [0.7, 0], [1, 0.5], [0.7, 1], [0, 1], [0.3, 0.5]])]],
    ['process', 'Process', 'Flowchart', 120, 60, () => [rect()]],
    ['decision', 'Decision', 'Flowchart', 120, 80, () => [diamond()]],
    ['terminator', 'Start / End', 'Flowchart', 120, 60, () => [rrect()]],
    ['data', 'Input / Output', 'Flowchart', 120, 60, () => [parallelogram()]],
    ['document', 'Document', 'Flowchart', 120, 80, () => [doc()]],
    ['predefined', 'Predefined process', 'Flowchart', 120, 60, () => [rect(), line([0.12, 0], [0.12, 1]), line([0.88, 0], [0.88, 1])]],
    ['preparation', 'Preparation', 'Flowchart', 120, 60, () => [hexagon()]],
    ['connector', 'Connector', 'Flowchart', 40, 40, () => [ell(0.5, 0.5, 0.5, 0.5)]],
    ['database', 'Database', 'Flowchart', 80, 100, cylinder],
    ['actor', 'Actor', 'Diagram / UML', 60, 120, () => [ell(0.5, 0.12, 0.22, 0.11), line([0.5, 0.23], [0.5, 0.62]), line([0.12, 0.38], [0.88, 0.38]), line([0.5, 0.62], [0.12, 1]), line([0.5, 0.62], [0.88, 1])]],
    ['umlclass', 'Class box', 'Diagram / UML', 140, 120, () => [rect(), line([0, 0.3], [1, 0.3]), line([0, 0.65], [1, 0.65])]],
    ['note', 'Note', 'Diagram / UML', 120, 80, () => [poly([[0, 0], [0.78, 0], [1, 0.22], [1, 1], [0, 1]]), poly([[0.78, 0], [0.78, 0.22], [1, 0.22]], false)]],
    ['package', 'Package', 'Diagram / UML', 140, 100, () => [poly([[0, 0], [0.4, 0], [0.4, 0.15], [1, 0.15], [1, 1], [0, 1]])]],
    ['and', 'AND gate', 'Logic gates', 120, 80, () => gate(andBody(), [[[0, 0.3], [0.2, 0.3]], [[0, 0.7], [0.2, 0.7]], [[0.76, 0.5], [1, 0.5]]])],
    ['or', 'OR gate', 'Logic gates', 120, 80, () => gate(orBody(), [[[0, 0.3], [0.29, 0.3]], [[0, 0.7], [0.29, 0.7]], [[0.82, 0.5], [1, 0.5]]])],
    ['not', 'NOT gate', 'Logic gates', 120, 60, () => gate([poly([[0.2, 0.05], [0.2, 0.95], [0.72, 0.5]])], [[[0, 0.5], [0.2, 0.5]], [[0.82, 0.5], [1, 0.5]]], [0.77, 0.05])],
    ['nand', 'NAND gate', 'Logic gates', 120, 80, () => gate(andBody(), [[[0, 0.3], [0.2, 0.3]], [[0, 0.7], [0.2, 0.7]], [[0.82, 0.5], [1, 0.5]]], [0.79, 0.04])],
    ['nor', 'NOR gate', 'Logic gates', 120, 80, () => gate(orBody(), [[[0, 0.3], [0.29, 0.3]], [[0, 0.7], [0.29, 0.7]], [[0.87, 0.5], [1, 0.5]]], [0.845, 0.035])],
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
