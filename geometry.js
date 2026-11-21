/* Geometry helpers + sketch recognition ("make my rough drawing exact").
 * Works in the browser (window.Geo) and in Node (module.exports) for tests. */
(function (root) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (!l2) return dist(p, a);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }

  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const a = pts[0], b = pts[pts.length - 1];
    let dmax = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = segDist(pts[i], a, b);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= eps) return [a, b];
    const l = rdp(pts.slice(0, idx + 1), eps), r = rdp(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }

  function pathLen(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
    return l;
  }

  function bbox(pts) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of pts) {
      x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
      x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  function turn(a, b, c) {
    const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  }

  // remove vertices of a closed polygon that are (almost) collinear
  function dropCollinear(poly, minTurn) {
    let changed = true;
    while (changed && poly.length > 3) {
      changed = false;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[(i + poly.length - 1) % poly.length], b = poly[i], c = poly[(i + 1) % poly.length];
        if (turn(a, b, c) < minTurn) { poly.splice(i, 1); changed = true; break; }
      }
    }
    return poly;
  }

  function ellipseError(pts, bb) {
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, rx = bb.w / 2 || 1, ry = bb.h / 2 || 1;
    let s = 0;
    for (const p of pts) s += Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
    return s / pts.length;
  }

  const snapv = (v, o) => (o.snap ? Math.round(v / o.grid) * o.grid : v);
  const snapPt = (p, o) => ({ x: snapv(p.x, o), y: snapv(p.y, o) });

  // Make a line horizontal / vertical / 45deg when it is nearly so, snap to grid.
  function alignLine(a, b, o) {
    a = snapPt(a, o); b = snapPt(b, o);
    const dx = b.x - a.x, dy = b.y - a.y;
    const ang = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
    if (ang < 9) b.y = a.y;
    else if (ang > 81) b.x = a.x;
    else if (Math.abs(45 - ang) < 7) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      b.x = a.x + Math.sign(dx) * m; b.y = a.y + Math.sign(dy) * m;
    }
    return [a, b];
  }

  function normRect(bb, o) {
    let x1 = snapv(bb.x, o), y1 = snapv(bb.y, o), x2 = snapv(bb.x + bb.w, o), y2 = snapv(bb.y + bb.h, o);
    if (x2 - x1 < o.grid) x2 = x1 + o.grid;
    if (y2 - y1 < o.grid) y2 = y1 + o.grid;
    let w = x2 - x1, h = y2 - y1;
    if (Math.abs(w - h) < 0.12 * Math.max(w, h)) { const m = Math.max(w, h); w = h = m; }
    return { x: x1, y: y1, w, h };
  }

  function smoothPts(pts, diag, closed) {
    let s = rdp(pts, Math.max(1.5, diag * 0.02));
    if (closed) s = s.slice(0, -1);
    if (s.length > 40) { const k = Math.ceil(s.length / 40); s = s.filter((_, i) => i % k === 0 || i === s.length - 1); }
    return s;
  }

  /* pts: raw freehand points [{x,y}] (world coordinates)
   * returns a clean shape description or null */
  function recognize(pts, o) {
    o = Object.assign({ grid: 20, snap: true, autofix: true }, o || {});
    const len = pathLen(pts);
    if (pts.length < 2 || len < 8) return null;
    const bb = bbox(pts), diag = Math.hypot(bb.w, bb.h);
    const first = pts[0], last = pts[pts.length - 1];
    const gap = dist(first, last);

    if (!o.autofix) {
      const closed = gap < 0.1 * len;
      return { type: 'curve', pts: smoothPts(pts, diag, closed).map((p) => ({ x: p.x, y: p.y })), closed };
    }

    let closed = gap < 0.2 * len && len > 40;
    if (closed && Math.min(bb.w, bb.h) < 0.12 * Math.max(bb.w, bb.h)) closed = false; // scribbled back & forth

    if (!closed) {
      // straight?
      let far = first, fd = 0;
      for (const p of pts) { const d = dist(p, first); if (d > fd) { fd = d; far = p; } }
      const end = len > 1.6 * gap ? far : last;
      let dev = 0;
      for (const p of pts) dev = Math.max(dev, segDist(p, first, end));
      if (dev < 0.1 * dist(first, end)) {
        const [a, b] = alignLine(first, end, o);
        if (dist(a, b) < 1) return null;
        return { type: 'line', pts: [a, b] };
      }
      // polyline with a few sharp corners?
      const s = rdp(pts, Math.max(3, diag * 0.025));
      if (s.length >= 3 && s.length <= 5) {
        let ok = true;
        for (let i = 1; i < s.length - 1; i++) if (turn(s[i - 1], s[i], s[i + 1]) < 0.55) ok = false;
        if (ok) {
          const q = s.map((p) => snapPt(p, o)).filter((p, i, a) => !i || p.x !== a[i - 1].x || p.y !== a[i - 1].y);
          if (q.length >= 3) return { type: 'poly', pts: q, closed: false };
        }
      }
      return { type: 'curve', pts: smoothPts(pts, diag, false), closed: false };
    }

    // closed shapes
    if (ellipseError(pts, bb) < 0.085) {
      const r = normRect(bb, o);
      return { type: 'ellipse', x: r.x, y: r.y, w: r.w, h: r.h };
    }
    let poly = rdp(pts, Math.max(4, diag * 0.07));
    if (dist(poly[0], poly[poly.length - 1]) < 1e-6 || gap < 0.2 * len) poly = poly.slice(0, -1);
    poly = dropCollinear(poly, 0.45);
    if (poly.length === 3) return { type: 'poly', pts: poly.map((p) => snapPt(p, o)), closed: true };
    if (poly.length === 4) {
      // axis-aligned rectangle?
      let aligned = true;
      for (let i = 0; i < 4; i++) {
        const a = poly[i], b = poly[(i + 1) % 4];
        const ang = (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;
        if (ang > 18 && ang < 72) aligned = false;
      }
      if (aligned) { const r = normRect(bbox(poly), o); return { type: 'rect', x: r.x, y: r.y, w: r.w, h: r.h }; }
      return { type: 'poly', pts: poly.map((p) => snapPt(p, o)), closed: true };
    }
    if (poly.length <= 8 && ellipseError(pts, bb) > 0.14) return { type: 'poly', pts: poly.map((p) => snapPt(p, o)), closed: true };
    if (ellipseError(pts, bb) < 0.14) {
      const r = normRect(bb, o);
      return { type: 'ellipse', x: r.x, y: r.y, w: r.w, h: r.h };
    }
    return { type: 'curve', pts: smoothPts(pts, diag, true), closed: true };
  }

  const api = { dist, segDist, rdp, pathLen, bbox, alignLine, normRect, snapv, snapPt, recognize, ellipseError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Geo = api;
})(typeof window !== 'undefined' ? window : globalThis);
