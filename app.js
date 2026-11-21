(function () {
  'use strict';
  let G = 20; const U = 40; // grid (default 0.5 cm), 40 px = 1 cm
  const MARGIN = 2 * U; // 2 cm page margin
  const $ = (id) => document.getElementById(id);
  const cv = $('c'), ctx = cv.getContext('2d');
  const CSS = { black: '#1d1d1d', red: '#e03131', blue: '#1971c2', 'green!50!black': '#2b8a3e', orange: '#f08c00', purple: '#9c36b5', gray: '#868e96' };
  const LWPX = { 1: 1.6, 2: 3, 3: 4.8 };
  const FSIZE = [12.7, 14.1, 16.9, 20.3, 29]; // \small \normalsize \large \Large \huge in px
  const fontOf = (s) => `${FSIZE[s.size === undefined ? 1 : s.size]}px "Latin Modern Roman","Times New Roman",serif`;
  const S = {
    shapes: [], sels: [], view: { x: 0, y: 0, z: 1 }, tool: 'pen',
    style: { route: 'straight', bend: 30, color: 'black', dashed: false, fill: false, fillOp: 0.3, arrow: '', lw: 1, rounded: false, size: 1 },
    opts: { snap: true, autofix: true, full: true, landscape: false },
  };
  let undo = [], redo = [], drag = null, draft = null, ghost = null, marquee = null, space = false, editing = null, nextId = 1, W = 0, H = 0, dpr = 1;

  /* ---------- page geometry (world px; (0,0) = top-left of text area) ---------- */
  const page = () => (S.opts.landscape ? { w: 29.7 * U, h: 21 * U } : { w: 21 * U, h: 29.7 * U });
  const area = () => { const p = page(); return { x: 0, y: 0, w: p.w - 2 * MARGIN, h: p.h - 2 * MARGIN }; };

  /* ---------- coordinates ---------- */
  const w2s = (p) => ({ x: p.x * S.view.z + S.view.x, y: p.y * S.view.z + S.view.y });
  const s2w = (p) => ({ x: (p.x - S.view.x) / S.view.z, y: (p.y - S.view.y) / S.view.z });
  const evPt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const sn = (v) => (S.opts.snap ? Math.round(v / G) * G : v);
  const geoOpts = () => ({ grid: G, snap: S.opts.snap, autofix: S.opts.autofix });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sel1 = () => (S.sels.length === 1 ? S.sels[0] : null);

  /* ---------- tools UI ---------- */
  const TOOLS = [
    ['select', '↖', 'Select & move – click/drag an element, or drag a box around several (V). Alt+drag = box select'], ['pen', '✎', 'Pen – draw freehand, auto-fixed (P)'], ['line', '╱', 'Line (L)'],
    ['arrow', '➜', 'Arrow (A)'], ['carrow', '↷', 'Curved arrow (C)'], ['earrow', '⮣', 'Elbow arrow (W)'], ['rect', '▭', 'Rectangle (R)'], ['ellipse', '◯', 'Ellipse / circle (O)'],
    ['text', 'T', 'Text (T) – click empty space to add, drag a label to move it, click it to edit'], ['eraser', '⌫', 'Eraser (E)'], ['hand', '✋', 'Pan (H or hold Space)'],
  ];
  const KEYS = { v: 'select', p: 'pen', l: 'line', a: 'arrow', c: 'carrow', w: 'earrow', r: 'rect', o: 'ellipse', t: 'text', e: 'eraser', h: 'hand' };
  TOOLS.forEach(([id, icon, title]) => {
    const b = document.createElement('button');
    b.textContent = icon; b.title = title; b.dataset.tool = id; b.onclick = () => setTool(id);
    $('tools').appendChild(b);
  });
  function setTool(t) {
    commitText(); S.tool = t;
    if (t !== 'select') S.sels = [];
    document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    cv.style.cursor = t === 'select' ? 'default' : t === 'hand' ? 'grab' : t === 'text' ? 'text' : 'crosshair';
    syncUI(); render();
  }

  /* ---------- inspector (style of new elements, or of the selection) ---------- */
  Object.keys(CSS).forEach((c) => {
    const b = document.createElement('button');
    b.className = 'sw'; b.style.background = CSS[c]; b.dataset.color = c; b.title = c; b.onclick = () => setStyle('color', c);
    $('colors').appendChild(b);
  });
  document.querySelectorAll('[data-lw]').forEach((b) => (b.onclick = () => setStyle('lw', +b.dataset.lw)));
  const cur = () => Object.assign({}, S.style, S.sels[0] || {});
  $('sDash').onclick = () => setStyle('dashed', !cur().dashed);
  $('sFill').onclick = () => setStyle('fill', !cur().fill);
  $('sOp').oninput = (e) => { $('sOpv').textContent = e.target.value + '%'; setStyle('fillOp', e.target.value / 100); };
  $('sRound').onclick = () => setStyle('rounded', !cur().rounded);
  $('sRoute').onchange = (e) => setStyle('route', e.target.value);
  $('sBend').oninput = (e) => setStyle('bend', +e.target.value);
  $('sArrow').onchange = (e) => setStyle('arrow', e.target.value);
  $('sSize').onchange = (e) => setStyle('size', +e.target.value);
  $('sText').oninput = () => { const s = sel1(); if (s && s.type === 'text') { s.text = $('sText').value || ' '; changedLive(); } };
  $('sText').onchange = () => { const s = sel1(); if (s && s.type === 'text') { if (!$('sText').value.trim()) remove([s]); else commit(); } };
  $('bDel').onclick = () => remove(S.sels.slice());
  $('bDup').onclick = dup;
  $('bFront').onclick = () => reorder(true); $('bBack').onclick = () => reorder(false);

  function applicable(s, k) {
    if (k === 'arrow' || k === 'route' || k === 'bend') return s.type === 'line';
    if (k === 'fill' || k === 'fillOp') return closedFill(s);
    if (k === 'rounded') return s.type === 'rect';
    if (k === 'size') return s.type === 'text';
    if (k === 'lw' || k === 'dashed') return s.type !== 'text';
    return true;
  }
  function setStyle(k, v) {
    S.style[k] = v;
    if (S.sels.length) { S.sels.forEach((s) => { if (applicable(s, k)) s[k] = v; }); commit(); }
    syncUI(); render();
  }
  function syncUI() {
    const st = cur(), n = S.sels.length;
    document.querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', b.dataset.color === st.color));
    document.querySelectorAll('[data-lw]').forEach((b) => b.classList.toggle('on', +b.dataset.lw === st.lw));
    $('sDash').classList.toggle('on', !!st.dashed); $('sFill').classList.toggle('on', !!st.fill); $('sRound').classList.toggle('on', !!st.rounded);
    $('sOp').value = Math.round((st.fillOp === undefined ? 0.3 : st.fillOp) * 100); $('sOpv').textContent = $('sOp').value + '%';
    $('sRoute').value = st.route || 'straight'; $('sBend').value = st.bend || 30; $('bendlbl').style.display = isBend(st) ? '' : 'none';
    $('sArrow').value = st.arrow || ''; $('sSize').value = st.size === undefined ? 1 : st.size;
    $('ititle').textContent = n === 0 ? 'Style for new elements' : n === 1 ? 'Selected: ' + ({ line: 'line', rect: 'rectangle', ellipse: 'ellipse', poly: 'polygon', curve: 'curve', text: 'text' }[S.sels[0].type]) : n + ' elements selected';
    const t = sel1(); $('textrow').style.display = t && t.type === 'text' ? '' : 'none';
    if (t && t.type === 'text' && document.activeElement !== $('sText')) $('sText').value = t.text;
    $('selrow').style.display = n ? '' : 'none';
  }

  /* ---------- history / persistence / output ---------- */
  function commit() {
    undo.push(JSON.stringify(S.shapes)); redo = [];
    if (undo.length > 200) undo.shift();
    changed();
  }
  const texOpts = () => ({ full: S.opts.full, landscape: S.opts.landscape });
  function changedLive() { $('code').value = Tikz.generate(S.shapes, texOpts()); render(); }
  function changed() {
    try { localStorage.setItem('draw_tex_v2', JSON.stringify({ shapes: S.shapes, landscape: S.opts.landscape })); } catch (e) {}
    $('code').value = Tikz.generate(S.shapes, texOpts());
    $('hint').style.display = S.shapes.length || draft ? 'none' : 'block';
    const a = area(); let out = false;
    S.shapes.forEach((s) => { const b = bboxOf(s); if (b.x < -2 || b.y < -2 || b.x + b.w > a.w + 2 || b.y + b.h > a.h + 2) out = true; });
    $('warn').style.display = out ? 'block' : 'none';
    scheduleCompile(); syncUI(); render();
  }
  function restore(json) { S.shapes = JSON.parse(json); S.sels = []; changed(); }
  $('undo').onclick = doUndo; $('redo').onclick = doRedo;
  function doUndo() { commitText(); if (undo.length > 1) { redo.push(undo.pop()); restore(undo[undo.length - 1]); } }
  function doRedo() { if (redo.length) { const j = redo.pop(); undo.push(j); restore(j); } }

  function remove(list) { if (!list.length) return; S.shapes = S.shapes.filter((s) => !list.includes(s)); S.sels = []; commit(); }
  function dup() {
    if (!S.sels.length) return;
    const copies = S.sels.map((s) => { const c = clone(s); c.id = nextId++; move(c, G, G); S.shapes.push(c); return c; });
    S.sels = copies; commit();
  }
  function reorder(front) {
    if (!S.sels.length) return;
    const rest = S.shapes.filter((s) => !S.sels.includes(s)), mine = S.shapes.filter((s) => S.sels.includes(s));
    S.shapes = front ? rest.concat(mine) : mine.concat(rest); commit();
  }

  /* ---------- shape helpers ---------- */
  const isPts = (s) => s.type === 'line' || s.type === 'poly' || s.type === 'curve';
  const isBox = (s) => s.type === 'rect' || s.type === 'ellipse';
  const closedFill = (s) => isBox(s) || ((s.type === 'poly' || s.type === 'curve') && s.closed);
  function mk(shape) {
    const st = S.style;
    shape.id = nextId++; shape.color = st.color;
    if (shape.type === 'text') { shape.size = st.size; return shape; }
    shape.dashed = st.dashed; shape.lw = st.lw;
    shape.fill = !!st.fill && closedFill(shape); shape.fillOp = st.fillOp;
    if (shape.type === 'line') { shape.arrow = shape.arrow || st.arrow; shape.route = shape.route || st.route; shape.bend = st.bend; }
    if (shape.type === 'rect') shape.rounded = !!st.rounded;
    return shape;
  }
  function textSize(s) { ctx.font = fontOf(s); return { w: ctx.measureText(s.text).width + 8, h: FSIZE[s.size === undefined ? 1 : s.size] + 8 }; }
  // path of a line/arrow in world px: straight, elbow or bezier ("bend left/right" like TikZ)
  function bendCtrl(s) {
    const [a, b] = s.pts, th = ((s.bend || 30) * Math.PI) / 180 * (s.route === 'bendL' ? 1 : -1);
    const ang = Math.atan2(-(b.y - a.y), b.x - a.x), d = 0.3915 * Geo.dist(a, b), o = ang + th, i = Math.PI + ang - th;
    return [{ x: a.x + d * Math.cos(o), y: a.y - d * Math.sin(o) }, { x: b.x + d * Math.cos(i), y: b.y - d * Math.sin(i) }];
  }
  const isBend = (s) => s.route === 'bendL' || s.route === 'bendR';
  function linePts(s) {
    const [a, b] = s.pts, r = s.route || 'straight';
    if (r === 'hv') return [a, { x: b.x, y: a.y }, b];
    if (r === 'vh') return [a, { x: a.x, y: b.y }, b];
    if (isBend(s)) {
      const [c1, c2] = bendCtrl(s), out = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24, m = 1 - t; out.push({ x: m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x, y: m * m * m * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * b.y }); }
      return out;
    }
    return [a, b];
  }
  function bboxOf(s) {
    if (s.type === 'line') return Geo.bbox(linePts(s));
    if (isPts(s)) return Geo.bbox(s.pts);
    if (isBox(s)) return { x: s.x, y: s.y, w: s.w, h: s.h };
    const t = textSize(s); return { x: s.x - t.w / 2, y: s.y - t.h / 2, w: t.w, h: t.h };
  }
  function move(s, dx, dy) { if (isPts(s)) s.pts.forEach((p) => { p.x += dx; p.y += dy; }); else { s.x += dx; s.y += dy; } }
  function inPoly(p, pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
      if ((pts[i].y > p.y) !== (pts[j].y > p.y) && p.x < ((pts[j].x - pts[i].x) * (p.y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x) c = !c;
    return c;
  }
  function hit(s, p, tol) {
    if (s.type === 'line') { const q = linePts(s); for (let i = 1; i < q.length; i++) if (Geo.segDist(p, q[i - 1], q[i]) < tol) return true; return false; }
    if (s.type === 'poly' || s.type === 'curve') {
      const n = s.pts.length;
      for (let i = 0; i < n - (s.closed ? 0 : 1); i++) if (Geo.segDist(p, s.pts[i], s.pts[(i + 1) % n]) < tol) return true;
      return !!(s.closed && s.fill && inPoly(p, s.pts));
    }
    if (s.type === 'rect') {
      const inside = p.x >= s.x - tol && p.x <= s.x + s.w + tol && p.y >= s.y - tol && p.y <= s.y + s.h + tol;
      if (!inside) return false;
      if (s.fill) return true;
      return Math.min(Math.abs(p.x - s.x), Math.abs(p.x - s.x - s.w), Math.abs(p.y - s.y), Math.abs(p.y - s.y - s.h)) < tol;
    }
    if (s.type === 'ellipse') {
      const rx = s.w / 2, ry = s.h / 2, r = Math.hypot((p.x - s.x - rx) / rx, (p.y - s.y - ry) / ry);
      return s.fill ? r <= 1 + tol / Math.min(rx, ry) : Math.abs(r - 1) * Math.min(rx, ry) < tol;
    }
    const b = bboxOf(s), pd = 6 + tol;
    return p.x >= b.x - pd && p.x <= b.x + b.w + pd && p.y >= b.y - pd && p.y <= b.y + b.h + pd;
  }
  function pick(p) {
    const tol = 8 / S.view.z;
    for (let i = S.shapes.length - 1; i >= 0; i--) if (hit(S.shapes[i], p, tol)) return S.shapes[i];
    return null;
  }
  // click inside an (unfilled) closed shape also grabs it – smallest shape wins
  function pickInside(p) {
    let best = null, ba = Infinity;
    for (const s of S.shapes) {
      let inside = false;
      if (s.type === 'rect') inside = p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
      else if (s.type === 'ellipse') inside = Math.hypot((p.x - s.x - s.w / 2) / (s.w / 2), (p.y - s.y - s.h / 2) / (s.h / 2)) <= 1;
      else if ((s.type === 'poly' || s.type === 'curve') && s.closed) inside = inPoly(p, s.pts);
      if (!inside) continue;
      const b = bboxOf(s), area = b.w * b.h;
      if (area <= ba) { best = s; ba = area; }
    }
    return best;
  }
  function handles(s) {
    if (!s) return [];
    if (s.type === 'line' || s.type === 'poly') return s.pts.map((p, i) => ({ id: i, x: p.x, y: p.y }));
    if (isBox(s)) return [['nw', s.x, s.y], ['ne', s.x + s.w, s.y], ['sw', s.x, s.y + s.h], ['se', s.x + s.w, s.y + s.h]].map(([id, x, y]) => ({ id, x, y }));
    return [];
  }

  /* ---------- rendering ---------- */
  function resize() {
    const r = cv.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
    const first = !W; W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    if (first) fitPage(); else render();
  }
  function fitPage() {
    const p = page(), z = Math.max(0.2, Math.min(2, Math.min((W - 40) / p.w, (H - 40) / p.h)));
    S.view = { z, x: (W - p.w * z) / 2 + MARGIN * z, y: (H - p.h * z) / 2 + MARGIN * z }; render();
  }
  window.addEventListener('resize', resize);

  function curvePath(c, pts, closed) {
    const n = pts.length; if (!n) return;
    c.moveTo(pts[0].x, pts[0].y);
    if (n === 2 && !closed) { c.lineTo(pts[1].x, pts[1].y); return; }
    const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    const cnt = closed ? n : n - 1, k = 0.55 / 3;
    for (let i = 0; i < cnt; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      c.bezierCurveTo(p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k, p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k, p2.x, p2.y);
    }
    if (closed) c.closePath();
  }
  function head(c, tip, from) {
    const d = Geo.dist(tip, from) || 1, ux = (tip.x - from.x) / d, uy = (tip.y - from.y) / d, L = 12, Wd = 5;
    c.setLineDash([]); c.beginPath(); c.moveTo(tip.x, tip.y);
    c.lineTo(tip.x - ux * L - uy * Wd, tip.y - uy * L + ux * Wd);
    c.lineTo(tip.x - ux * (L - 3), tip.y - uy * (L - 3));
    c.lineTo(tip.x - ux * L + uy * Wd, tip.y - uy * L - ux * Wd); c.closePath(); c.fill();
  }

  function drawShape(c, s) {
    const col = CSS[s.color] || '#000';
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = LWPX[s.lw] || 1.6;
    c.setLineDash(s.dashed ? [8, 6] : []); c.lineJoin = 'miter'; c.lineCap = 'butt';
    const fillIt = () => { if (s.fill) { c.save(); c.globalAlpha = s.fillOp === undefined ? 0.3 : s.fillOp; c.fill(); c.restore(); } };
    c.beginPath();
    switch (s.type) {
      case 'line': {
        const ar = s.arrow === true ? '->' : s.arrow || '', hasEnd = ar.endsWith('>'), hasStart = ar.startsWith('<');
        const unit = (p, q) => { const d = Geo.dist(p, q) || 1; return { x: (q.x - p.x) / d, y: (q.y - p.y) / d }; };
        const back = (p, u, n) => ({ x: p.x - u.x * n, y: p.y - u.y * n });
        if (isBend(s)) {
          let [a, b] = s.pts; const [c1, c2] = bendCtrl(s), u0 = unit(c1, a), u1 = unit(c2, b);
          const a2 = hasStart ? back(a, u0, 9) : a, b2 = hasEnd ? back(b, u1, 9) : b;
          c.moveTo(a2.x, a2.y); c.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b2.x, b2.y); c.stroke();
          if (hasEnd) head(c, b, back(b, u1, 1)); if (hasStart) head(c, a, back(a, u0, 1));
          return;
        }
        const q = linePts(s).map((p) => ({ x: p.x, y: p.y })), n = q.length;
        const uS = unit(q[1], q[0]), uE = unit(q[n - 2], q[n - 1]), tipS = q[0], tipE = q[n - 1];
        if (hasStart) { q[0] = back(q[0], uS, 9); }
        if (hasEnd) { q[n - 1] = back(q[n - 1], uE, 9); }
        q.forEach((p, k) => (k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
        if (hasEnd) head(c, tipE, back(tipE, uE, 1)); if (hasStart) head(c, tipS, back(tipS, uS, 1));
        return;
      }
      case 'rect':
        if (s.rounded && c.roundRect) c.roundRect(s.x, s.y, s.w, s.h, 6); else c.rect(s.x, s.y, s.w, s.h);
        fillIt(); c.stroke(); return;
      case 'ellipse': c.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); fillIt(); c.stroke(); return;
      case 'poly': s.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); if (s.closed) c.closePath(); fillIt(); c.stroke(); return;
      case 'curve': curvePath(c, s.pts, s.closed); fillIt(); c.stroke(); return;
      case 'text': c.font = fontOf(s); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.text, s.x, s.y); return;
    }
  }

  function render() {
    const z = S.view.z, pg = page(), ar = area();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e4e4e0'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * S.view.x, dpr * S.view.y);
    // A4 sheet
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 14; ctx.fillStyle = '#fff';
    ctx.fillRect(-MARGIN, -MARGIN, pg.w, pg.h); ctx.restore();
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1 / z; ctx.strokeStyle = '#8fb3d9'; ctx.strokeRect(0, 0, ar.w, ar.h); ctx.setLineDash([]);
    ctx.fillStyle = '#9aa'; ctx.font = `${11 / z}px system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`A4 ${S.opts.landscape ? 'landscape' : 'portrait'} · text area ${(ar.w / U).toFixed(0)}×${(ar.h / U).toFixed(1)} cm`, 0, -6 / z);
    // grid dots on page
    if (G * z >= 5) {
      ctx.fillStyle = '#c9c9c4';
      const a0 = s2w({ x: 0, y: 0 }), b = s2w({ x: W, y: H });
      const x1 = Math.max(-MARGIN, Math.floor(a0.x / G) * G), y1 = Math.max(-MARGIN, Math.floor(a0.y / G) * G);
      const x2 = Math.min(pg.w - MARGIN, b.x), y2 = Math.min(pg.h - MARGIN, b.y);
      for (let x = x1; x <= x2; x += G) for (let y = y1; y <= y2; y += G) {
        const big = x % U === 0 && y % U === 0 || G >= U, r = (big ? 1.2 : 0.7) / z; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }
    S.shapes.forEach((s) => { if (!s._hidden) drawShape(ctx, s); });
    if (draft) {
      if (draft.raw) {
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath();
        draft.raw.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      } else drawShape(ctx, draft);
    }
    if (ghost) {
      const t = (performance.now() - ghost.t) / 700;
      if (t < 1) {
        ctx.save(); ctx.globalAlpha = 0.5 * (1 - t); ctx.strokeStyle = '#d6336c'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath();
        ghost.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
        requestAnimationFrame(render);
      } else ghost = null;
    }
    // selection overlay (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.sels.forEach((s) => {
      const b = bboxOf(s), p = w2s({ x: b.x, y: b.y }), pad = 5;
      ctx.strokeStyle = '#1971c2'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.strokeRect(p.x - pad, p.y - pad, b.w * z + 2 * pad, b.h * z + 2 * pad); ctx.setLineDash([]);
    });
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1971c2';
    handles(sel1()).forEach((h) => { const q = w2s(h); ctx.fillRect(q.x - 4, q.y - 4, 8, 8); ctx.strokeRect(q.x - 4, q.y - 4, 8, 8); });
    if (marquee) {
      const a = w2s(marquee.a), b = w2s(marquee.b);
      ctx.fillStyle = 'rgba(25,113,194,.08)'; ctx.strokeStyle = '#1971c2'; ctx.setLineDash([4, 3]);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
    }
    $('zlabel').textContent = Math.round(z * 100) + '%';
  }

  /* ---------- pointer interaction ---------- */
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    const sp = evPt(e), p = s2w(sp);
    if (e.button === 1 || S.tool === 'hand' || space) { drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y }; cv.style.cursor = 'grabbing'; return; }
    if (e.button !== 0) return;
    commitText();
    switch (S.tool) {
      case 'select': {
        for (const h of handles(sel1())) if (Math.hypot(w2s(h).x - sp.x, w2s(h).y - sp.y) < 9) { drag = { mode: 'handle', h: h.id, orig: clone(sel1()) }; return; }
        const s = e.altKey ? null : pick(p) || pickInside(p);
        if (s) {
          if (e.shiftKey) { S.sels = S.sels.includes(s) ? S.sels.filter((x) => x !== s) : S.sels.concat(s); }
          else if (!S.sels.includes(s)) S.sels = [s];
          drag = { mode: 'move', start: p, orig: S.sels.map(clone), moved: false };
        } else { if (!e.shiftKey) S.sels = []; marquee = { a: p, b: p }; drag = { mode: 'marquee', base: S.sels.slice() }; }
        syncUI(); render(); return;
      }
      case 'pen': drag = { mode: 'pen' }; draft = { raw: [p] }; return;
      case 'line': case 'arrow': case 'carrow': case 'earrow':
        drag = { mode: 'shape', a: p };
        draft = mk({ type: 'line', pts: [p, p], arrow: S.tool === 'line' ? S.style.arrow : S.style.arrow || '->', route: S.tool === 'carrow' ? 'bendL' : S.tool === 'earrow' ? 'hv' : S.style.route }); return;
      case 'rect': case 'ellipse': drag = { mode: 'shape', a: p }; draft = mk({ type: S.tool, x: p.x, y: p.y, w: 0, h: 0 }); return;
      case 'text': {
        const s = pick(p);
        if (s && s.type === 'text') { S.sels = [s]; drag = { mode: 'move', start: p, orig: [clone(s)], moved: false, textEdit: s }; syncUI(); render(); }
        else openText(null, { x: sn(p.x), y: sn(p.y) });
        e.preventDefault(); return;
      }
      case 'eraser': drag = { mode: 'erase', any: false }; eraseAt(p); return;
    }
  });

  function eraseAt(p) { const s = pick(p); if (s) { S.shapes.splice(S.shapes.indexOf(s), 1); drag.any = true; render(); } }

  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const sp = evPt(e), p = s2w(sp);
    switch (drag.mode) {
      case 'pan': S.view.x = drag.vx + e.clientX - drag.sx; S.view.y = drag.vy + e.clientY - drag.sy; break;
      case 'pen': draft.raw.push(p); break;
      case 'erase': eraseAt(p); break;
      case 'marquee': {
        marquee.b = p;
        const x1 = Math.min(marquee.a.x, p.x), x2 = Math.max(marquee.a.x, p.x), y1 = Math.min(marquee.a.y, p.y), y2 = Math.max(marquee.a.y, p.y);
        const inside = S.shapes.filter((s) => { const b = bboxOf(s); return b.x + b.w >= x1 && b.x <= x2 && b.y + b.h >= y1 && b.y <= y2; });
        S.sels = Array.from(new Set(drag.base.concat(inside))); break;
      }
      case 'shape': {
        const a = drag.a;
        if (draft.type === 'line') draft.pts = (draft.route || 'straight') === 'straight' ? Geo.alignLine(a, p, geoOpts()) : [{ x: sn(a.x), y: sn(a.y) }, { x: sn(p.x), y: sn(p.y) }];
        else {
          const raw = { x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) };
          Object.assign(draft, S.opts.snap ? Geo.normRect(raw, { grid: G, snap: true }) : raw);
        }
        break;
      }
      case 'move': {
        const dx = sn(p.x - drag.start.x), dy = sn(p.y - drag.start.y);
        S.sels.forEach((s, i) => { const o = clone(drag.orig[i]); move(o, dx, dy); Object.assign(s, o); });
        drag.moved = drag.moved || dx !== 0 || dy !== 0; break;
      }
      case 'handle': {
        const s = sel1(), o = drag.orig, q = { x: sn(p.x), y: sn(p.y) };
        if (s.type === 'line') { const i = drag.h; s.pts[i] = (s.route || 'straight') === 'straight' ? Geo.alignLine(o.pts[1 - i], q, { grid: G, snap: false })[1] : q; }
        else if (s.type === 'poly') s.pts[drag.h] = q;
        else if (isBox(s)) {
          const fx = drag.h.includes('w') ? o.x + o.w : o.x, fy = drag.h.includes('n') ? o.y + o.h : o.y;
          s.x = Math.min(fx, q.x); s.y = Math.min(fy, q.y); s.w = Math.max(G / 2, Math.abs(q.x - fx)); s.h = Math.max(G / 2, Math.abs(q.y - fy));
        }
        break;
      }
    }
    render();
  });

  cv.addEventListener('pointerup', () => {
    const d = drag; drag = null;
    if (!d) return;
    const keep = S.sels.slice(); setTool(S.tool); S.sels = keep; // restores cursor (setTool clears selection for non-select tools only)
    if (d.mode === 'pen') {
      const raw = draft.raw; draft = null;
      const r = Geo.recognize(raw, geoOpts());
      if (r) { S.shapes.push(mk(r)); ghost = { pts: raw, t: performance.now() }; commit(); } else changed();
    } else if (d.mode === 'shape') {
      const s = draft; draft = null;
      const ok = s.type === 'line' ? Geo.dist(s.pts[0], s.pts[1]) > 4 : s.w > 4 && s.h > 4;
      if (ok) { S.shapes.push(s); commit(); } else changed();
    } else if (d.mode === 'erase') { if (d.any) { S.sels = []; commit(); } }
    else if (d.mode === 'move') { if (d.moved) commit(); else if (d.textEdit) openText(d.textEdit); }
    else if (d.mode === 'handle') commit();
    else if (d.mode === 'marquee') { marquee = null; syncUI(); }
    render();
  });

  cv.addEventListener('dblclick', (e) => { const s = pick(s2w(evPt(e))); if (s && s.type === 'text') openText(s); });

  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const sp = evPt(e);
    if (e.ctrlKey || e.metaKey) zoomAt(sp, Math.exp(-e.deltaY * 0.01));
    else if (e.shiftKey || e.deltaX) { S.view.x -= e.deltaX || e.deltaY; render(); }
    else if (Math.abs(e.deltaY) >= 50) zoomAt(sp, Math.exp(-e.deltaY * 0.0015));
    else { S.view.y -= e.deltaY; render(); }
  }, { passive: false });
  function zoomAt(sp, f) {
    const z = Math.max(0.2, Math.min(4, S.view.z * f)), k = z / S.view.z;
    S.view.x = sp.x - (sp.x - S.view.x) * k; S.view.y = sp.y - (sp.y - S.view.y) * k; S.view.z = z; render();
  }
  $('zin').onclick = () => zoomAt({ x: W / 2, y: H / 2 }, 1.25);
  $('zout').onclick = () => zoomAt({ x: W / 2, y: H / 2 }, 0.8);
  $('zfit').onclick = fitPage;

  /* ---------- text editing ---------- */
  function openText(shape, pos) {
    commitText();
    editing = { shape, pos };
    const c = shape || pos, q = w2s(c), t = $('textin');
    t.style.display = 'block'; t.style.left = q.x + 'px'; t.style.top = q.y + 'px';
    t.value = shape ? shape.text : ''; t.style.fontSize = FSIZE[shape && shape.size !== undefined ? shape.size : S.style.size] * S.view.z + 'px';
    if (shape) shape._hidden = true;
    render(); setTimeout(() => t.focus(), 0);
  }
  function commitText(finish) {
    if (!editing) return;
    const t = $('textin'), v = t.value.trim(), { shape, pos } = editing;
    editing = null; t.style.display = 'none';
    if (shape) {
      delete shape._hidden;
      if (!v) S.shapes.splice(S.shapes.indexOf(shape), 1); else shape.text = v;
      commit();
    } else if (v) { const s = mk({ type: 'text', x: pos.x, y: pos.y, text: v }); S.shapes.push(s); commit(); if (finish === true) { setTool('select'); S.sels = [s]; syncUI(); render(); } }
  }
  $('textin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitText(true); }
    if (e.key === 'Escape') { const s = editing && editing.shape; if (s) delete s._hidden; editing = null; $('textin').style.display = 'none'; render(); }
    e.stopPropagation();
  });
  $('textin').addEventListener('blur', commitText);

  /* ---------- keyboard ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    if (e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (k === ' ') { space = true; e.preventDefault(); return; }
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
    if (mod && k === 'y') { e.preventDefault(); doRedo(); return; }
    if (mod && k === 'd') { e.preventDefault(); dup(); return; }
    if (mod && k === 'a') { e.preventDefault(); setTool('select'); S.sels = S.shapes.slice(); syncUI(); render(); return; }
    if ((k === 'delete' || k === 'backspace') && S.sels.length) { remove(S.sels.slice()); return; }
    if (k === 'escape') { S.sels = []; syncUI(); render(); return; }
    if (S.sels.length && k.startsWith('arrow')) {
      e.preventDefault(); const d = { arrowleft: [-G, 0], arrowright: [G, 0], arrowup: [0, -G], arrowdown: [0, G] }[k];
      S.sels.forEach((s) => move(s, d[0], d[1])); commit(); return;
    }
    if (!mod && KEYS[k]) setTool(KEYS[k]);
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') space = false; });

  /* ---------- header + output buttons ---------- */
  $('optFix').onchange = (e) => (S.opts.autofix = e.target.checked);
  $('optSnap').onchange = (e) => (S.opts.snap = e.target.checked);
  $('optFull').onchange = (e) => { S.opts.full = e.target.checked; changed(); };
  $('optGrid').onchange = (e) => { G = +e.target.value; try { localStorage.setItem('draw_tex_grid', G); } catch (x) {} render(); };
  $('optOri').onchange = (e) => { S.opts.landscape = e.target.value === 'l'; fitPage(); changed(); };
  $('clear').onclick = () => { if (!S.shapes.length || confirm('Clear the whole drawing?')) { S.shapes = []; S.sels = []; commit(); } };
  $('tidy').onclick = () => {
    const o = { grid: G, snap: true };
    S.shapes.forEach((s) => {
      if (s.type === 'line') s.pts = (s.route || 'straight') === 'straight' ? Geo.alignLine(s.pts[0], s.pts[1], o) : s.pts.map((p) => Geo.snapPt(p, o));
      else if (s.type === 'poly' || s.type === 'curve') s.pts = s.pts.map((p) => Geo.snapPt(p, o));
      else if (isBox(s)) Object.assign(s, Geo.normRect(s, o));
      else if (s.type === 'text') { s.x = Geo.snapv(s.x, o); s.y = Geo.snapv(s.y, o); }
    });
    commit();
  };
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('code').value); } catch (e) { $('code').select(); document.execCommand('copy'); }
    $('copy').textContent = 'Copied ✓'; setTimeout(() => ($('copy').textContent = 'Copy code'), 1500);
  };
  $('dl').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('code').value], { type: 'text/x-tex' }));
    a.download = 'drawing.tex'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('ovl').onclick = () => {
    $('ovlsnip').value = encodeURIComponent(Tikz.generate(S.shapes, { full: true, landscape: S.opts.landscape }));
    $('ovlform').submit();
  };

  /* ---------- PDF compile (needs: node server.js) ---------- */
  let ctimer = null, cseq = 0, pdfUrl = null;
  $('compile').onclick = compileNow;
  const applyZoom = () => { $('pdf').style.width = $('pzoom').value + '%'; };
  $('pzoom').onchange = applyZoom; applyZoom();
  $('pdfopen').onclick = async () => {
    try {
      const r = await fetch('/compile', { method: 'POST', body: Tikz.generate(S.shapes, { full: true, landscape: S.opts.landscape }) });
      if (r.ok) window.open(URL.createObjectURL(await r.blob()), '_blank');
    } catch (e) {}
  };
  function scheduleCompile() { clearTimeout(ctimer); if ($('optAuto').checked) ctimer = setTimeout(compileNow, 700); }
  async function compileNow() {
    if (!S.shapes.length) { $('pdfstatus').textContent = 'Draw something first'; return; }
    const my = ++cseq; $('pdfstatus').textContent = 'Compiling…';
    try {
      const r = await fetch('/compile?format=png', { method: 'POST', body: Tikz.generate(S.shapes, { full: true, landscape: S.opts.landscape }) });
      if (my !== cseq) return;
      if (r.ok && !(r.headers.get('content-type') || '').includes('image/png')) {
        $('pdflog').textContent = 'The server is outdated. Stop it (Ctrl+C) and start it again with:  node server.js'; $('pdflog').style.display = 'block'; $('pdfstatus').textContent = 'Restart server'; return;
      }
      if (r.ok) {
        const url = URL.createObjectURL(await r.blob());
        $('pdf').src = url; if (pdfUrl) URL.revokeObjectURL(pdfUrl); pdfUrl = url;
        $('pdflog').style.display = 'none'; $('pdfstatus').textContent = 'Compiled ✓ (' + S.shapes.length + ' elements)';
      } else { $('pdflog').textContent = (r.status === 404 || r.status === 501 ? 'Wrong server: stop it and run  node server.js  in the project folder, then open http://localhost:8000\n' : '') + await r.text(); $('pdflog').style.display = 'block'; $('pdfstatus').textContent = 'LaTeX error'; }
    } catch (e) {
      $('pdflog').textContent = 'Compile server not reachable.\nStart it in the project folder with:  node server.js\nand open http://localhost:8000 (not the file directly).';
      $('pdflog').style.display = 'block'; $('pdfstatus').textContent = 'No server';
    }
  }

  /* ---------- init ---------- */
  try {
    const saved = JSON.parse(localStorage.getItem('draw_tex_v2') || 'null');
    if (saved && Array.isArray(saved.shapes)) {
      S.shapes = saved.shapes; S.opts.landscape = !!saved.landscape; $('optOri').value = S.opts.landscape ? 'l' : 'p';
      S.shapes.forEach((s) => { nextId = Math.max(nextId, (s.id || 0) + 1); if (s.type === 'line' && s.arrow === true) s.arrow = '->'; });
    }
  } catch (e) {}
  try { const g = +localStorage.getItem('draw_tex_grid'); if (g) { G = g; $('optGrid').value = String(g); } } catch (e) {}
  undo = [JSON.stringify(S.shapes)];
  setTool('pen'); resize(); changed();
})();
