# draw_tex — Sketch → TikZ

A tldraw-style whiteboard that turns rough sketches into clean shapes and generates
TikZ code you can compile in Overleaf.

## Run
    node server.js     # then open http://localhost:8000

The server also compiles your drawing with `pdflatex` for the **PDF preview** tab
(auto-recompiles while you draw). Without the server (just opening `index.html`) everything
works except the PDF preview. Big drawings are auto-scaled with `scale=` to fit the page.

## Use
- **Pen (P)**: draw freehand. Wobbly lines become straight/horizontal/vertical/45°,
  rough boxes → rectangles, rough rounds → ellipses/circles, 3–4 corner loops → polygons,
  other strokes → smooth curves. Everything snaps to a 0.5 cm grid.
- Tools: select/move/resize (V), line (L), arrow (A), rectangle (R), ellipse (O),
  text (T, LaTeX math like `$x^2$` works), eraser (E), pan (H / Space).
- Style bar: colour, thickness, dashed, fill, arrow head.
- The right panel shows the TikZ code live. **Copy**, **Download .tex**, or **Open in Overleaf**.
- *Tidy all* snaps every existing shape to the grid. Ctrl+Z / Ctrl+Y undo/redo, Ctrl+D duplicate.

Generated documents use `\usepackage{tikz}` and `\usetikzlibrary{arrows.meta}`.
Scale: 40 px on canvas = 1 cm.
