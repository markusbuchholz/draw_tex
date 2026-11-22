// Tiny local server: serves the app and compiles LaTeX -> PDF with pdflatex.
// Usage: node server.js   (then open http://localhost:8000)
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { execFile } = require('child_process');
const PORT = +process.env.PORT || 8000, ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function compile(tex, png, cb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drawtex-'));
  fs.writeFileSync(path.join(dir, 'drawing.tex'), tex);
  execFile('pdflatex', ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'drawing.tex'],
    { cwd: dir, timeout: 30000, env: Object.assign({}, process.env, { openin_any: 'p', openout_any: 'p' }) },
    (err, stdout) => {
      let pdf = null;
      try { pdf = fs.readFileSync(path.join(dir, 'drawing.pdf')); } catch (e) {}
      const done = (out, extra) => {
        fs.rm(dir, { recursive: true, force: true }, () => {});
        cb(err && !pdf ? extra : { pdf: out });
      };
      if (pdf && png) {
        return execFile('pdftoppm', ['-png', '-scale-to-x', '1600', '-scale-to-y', '-1', 'drawing.pdf', 'page'], { cwd: dir, timeout: 60000 }, () => {
          const files = fs.readdirSync(dir).filter((f) => /^page-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
          const pages = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
          fs.rm(dir, { recursive: true, force: true }, () => {});
          cb(pages.length ? { pdf: Buffer.from(JSON.stringify({ pages })), json: true } : { error: 'pdftoppm failed – install poppler-utils' });
        });
      }
      done(pdf, !err ? null : { error: err.code === 'ENOENT' ? 'pdflatex not found – install TeX Live' : stdout.split('\n').filter((l) => /^!|^l\.\d|Error/.test(l)).join('\n') || String(err.message) });
    });
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/compile')) {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => compile(body, req.url.includes('format=png'), (r) => {
      if (r.pdf) { res.writeHead(200, { 'Content-Type': r.json ? 'application/json' : 'application/pdf' }); res.end(r.pdf); }
      else { res.writeHead(422, { 'Content-Type': 'text/plain' }); res.end(r.error); }
    }));
    return;
  }
  const f = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const p = path.join(ROOT, path.normalize(f));
  if (!p.startsWith(ROOT) || !TYPES[path.extname(p)] || !fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)], 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Sketch→TikZ running at http://localhost:${PORT}`));
