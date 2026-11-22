/* Shapes -> TikZ code. 40 world px = 1 cm. y axis is flipped. */
(function (root) {
  const Shapes = typeof require !== 'undefined' ? require('./shapes.js') : root.Shapes;
  const UNIT = 40;
  const fmt = (n) => String(+n.toFixed(2) + 0);
  const X = (x) => fmt(x / UNIT);
  const Y = (y) => fmt(-y / UNIT);
  const P = (p) => `(${X(p.x)},${Y(p.y)})`;

  function esc(t) {
    if (t.includes('$')) return t; // user writes math: keep as is
    return t
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([#%&_{}])/g, '\\$1')
      .replace(/\$/g, '\\$')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  const LW = { 1: null, 2: 'thick', 3: 'ultra thick' };

  function opts(s, extra) {
    const o = [];
    if (extra) o.push(extra);
    if (s.color && s.color !== 'black') o.push(s.color);
    if (s.dashed) o.push('dashed');
    if (LW[s.lw]) o.push(LW[s.lw]);
    return o;
  }
  const fillOpt = (s) => (s.fill ? `fill=${s.color || 'black'}, fill opacity=${+(s.fillOp === undefined ? 0.3 : s.fillOp).toFixed(2)}` : null);
  // clockwise-on-screen angle -> TikZ (counter-clockwise, y up) rotation about the shape centre
  const rotOpt = (s, c) => (s.rot ? `rotate around={${fmt(-s.rot)}:${P(c)}}` : null);
  const boxC = (s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
  const wrap = (o) => (o.length ? `[${o.join(', ')}]` : '');

  function shapeToTikz(s) {
    switch (s.type) {
      case 'line': {
        const o = opts(s, s.arrow || null);
        const r = s.route || 'straight';
        const link = r === 'hv' ? '-|' : r === 'vh' ? '|-' : r === 'bendL' ? `to[bend left=${s.bend || 30}]` : r === 'bendR' ? `to[bend right=${s.bend || 30}]` : '--';
        return `\\draw${wrap(o)} ${P(s.pts[0])} ${link} ${P(s.pts[1])};`;
      }
      case 'rect': {
        const o = opts(s, fillOpt(s)); if (s.rounded) o.push('rounded corners'); if (s.rot) o.push(rotOpt(s, boxC(s)));
        return `\\draw${wrap(o)} ${P({ x: s.x, y: s.y + s.h })} rectangle ${P({ x: s.x + s.w, y: s.y })};`;
      }
      case 'ellipse': {
        const o = opts(s, fillOpt(s)); if (s.rot) o.push(rotOpt(s, boxC(s)));
        const c = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
        if (Math.abs(s.w - s.h) < 1) return `\\draw${wrap(o)} ${P(c)} circle (${fmt(s.w / 2 / UNIT)});`;
        return `\\draw${wrap(o)} ${P(c)} ellipse (${fmt(s.w / 2 / UNIT)} and ${fmt(s.h / 2 / UNIT)});`;
      }
      case 'poly': {
        s = Object.assign({}, s, { pts: s.pts.filter((p, i, a) => !i || p.x !== a[i - 1].x || p.y !== a[i - 1].y) });
        const o = opts(s, s.closed ? fillOpt(s) : null);
        return `\\draw${wrap(o)} ${s.pts.map(P).join(' -- ')}${s.closed ? ' -- cycle' : ''};`;
      }
      case 'curve': {
        const o = opts(s, s.closed ? fillOpt(s) : null);
        return `\\draw${wrap(o)} plot[${s.closed ? 'smooth cycle' : 'smooth'}] coordinates {${s.pts.map(P).join(' ')}};`;
      }
      case 'lib': {
        const o = opts(s, fillOpt(s)); if (s.rot) o.push(rotOpt(s, boxC(s)));
        let out = `\\draw${wrap(o)} ${Shapes.tikz(s, P)};`;
        if (s.text) {
          const to = []; if (s.rot) to.push(`rotate=${fmt(-s.rot)}`);
          if (s.color && s.color !== 'black') to.push(`text=${s.color}`);
          if (s.size !== undefined && s.size !== 1 && SIZES[s.size]) to.push(`font=${SIZES[s.size]}`);
          out += `\n  \\node${wrap(to)} at ${P({ x: s.x + s.w / 2, y: s.y + s.h / 2 })} {${esc(s.text)}};`;
        }
        return out;
      }
      case 'text': {
        const o = []; if (s.rot) o.push(`rotate=${fmt(-s.rot)}`);
        if (s.color && s.color !== 'black') o.push(`text=${s.color}`);
        if (s.size !== undefined && s.size !== 1 && SIZES[s.size]) o.push(`font=${SIZES[s.size]}`);
        return `\\node${wrap(o)} at ${P(s)} {${esc(s.text)}};`;
      }
    }
    return '';
  }

  // A4 text area (2 cm margins) in cm
  // paper formats in cm (portrait: width x height)
  const FORMATS = { A0: [84.1, 118.9], A1: [59.4, 84.1], A2: [42, 59.4], A3: [29.7, 42], A4: [21, 29.7], A5: [14.8, 21], A6: [10.5, 14.8], Letter: [21.59, 27.94] };
  function pageSize(o) { const f = FORMATS[o.format] || FORMATS.A4, m = o.margin === undefined ? 2 : o.margin, w = o.landscape ? f[1] : f[0], h = o.landscape ? f[0] : f[1]; return { pw: w, ph: h, w: w - 2 * m, h: h - 2 * m, m }; }
  const SIZES = [null, null, '\\large', '\\Large', '\\huge'];
  SIZES[0] = '\\small';

  // shapes: array of shapes (one page) – or pass o.pages = [shapes, shapes, ...] for several pages
  function generate(shapes, o) {
    o = Object.assign({ full: true, landscape: false, format: 'A4', margin: 2 }, o || {});
    const pg = pageSize(o);
    const pages = o.pages || [shapes || []];
    const box = o.full ? `  \\useasboundingbox (0,0) rectangle (${fmt(pg.w)},${fmt(-(pg.h - 0.1))});\n` : '';
    const pics = pages.map((sh) => {
      const body = sh.length ? sh.map((s) => '  ' + shapeToTikz(s)).join('\n') : '  % (empty page)';
      return `\\begin{tikzpicture}[>={Stealth[length=2.5mm]}, semithick]\n${box}${body}\n\\end{tikzpicture}`;
    });
    if (!o.full) return '% (0,0) = top-left corner of the text area; 1 unit = 1 cm\n' + pics.map((p, i) => (i ? `\\newpage\n% ---- page ${i + 1} ----\n` : '') + p).join('\n');
    return [
      '\\documentclass{article}',
      '\\usepackage[utf8]{inputenc}',
      `\\usepackage[paperwidth=${fmt(pg.pw)}cm,paperheight=${fmt(pg.ph)}cm,margin=${fmt(pg.m)}cm]{geometry}`,
      '\\usepackage{tikz}',
      '\\usetikzlibrary{arrows.meta}',
      '\\pagestyle{empty}',
      '\\setlength{\\parindent}{0pt}',
      '',
      '\\begin{document}',
      pics.map((p, i) => (i ? `\\newpage\n% ---- page ${i + 1} ----\n` : '') + p).join('\n'),
      '\\end{document}',
      '',
    ].join('\n');
  }

  const api = { generate, shapeToTikz, UNIT, FORMATS, pageSize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tikz = api;
})(typeof window !== 'undefined' ? window : globalThis);
