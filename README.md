# draw_tex

A simple application for drawing diagrams on a canvas and converting them to TikZ code for LaTeX/Overleaf.

It includes many features known from modern sketching tools: rough hand-drawn strokes are cleaned up into exact shapes, and the TikZ code and a PDF preview update live.

## Run

```bash
node run_server.js
```

Then open <http://localhost:8000>.

The server compiles the drawing with `pdflatex` for the PDF preview. Without it (opening `index.html` directly) everything works except the preview.


