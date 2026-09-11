# Widget demo

A static page with `<docs-ask>` over the 30 Fastify doc files in `test/fixtures/fastify`.

```bash
npm run demo          # builds the package, writes docs-index.json here, then serves on :8000
```

Then open http://localhost:8000 and press `/`.

The page loads `docs-ask-widget.iife.js` and `docs-index.json` from this folder. Both are built, so both are
git ignored. On a real site the script comes from a CDN and the index from wherever `docs-ask build --target web`
put it:

```html
<script src="https://cdn.jsdelivr.net/npm/docs-ask@0.1/dist/docs-ask-widget.iife.js"></script>
<docs-ask index="/docs-index.json" base-url="/docs/"></docs-ask>
```

With `base-url` set, picking a result goes to `base-url + file + #slug`. Without it, as here, the page hears
`docs-ask:select` and decides for itself.
