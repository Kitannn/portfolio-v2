# kitannn° portfolio v2

A window/desktop-style redesign (inspired by 109ichiki.com) with birbKit as the centerpiece.
Deploys to **https://v2.kitannn.com** via GitHub Pages (`CNAME` file in this repo).

## ✏️ Updating content later (checklist)

1. Edit content in the **main site**: `E:\Dev\Kitannn\Portfolio\data.js` (text, work entries, responsibilities),
   and add/replace photos in `Portfolio\images\` or the résumé in `Portfolio\assets\resume\`.
2. Commit and push the **Portfolio** repo → updates kitannn.com.
3. In this folder, copy the changes over:
   ```powershell
   cd E:\Dev\Kitannn\Portfolio-v2
   powershell -ExecutionPolicy Bypass -File .\sync.ps1
   ```
4. If you changed `data.js`, bump `data.js?v=N` in `index.html` so browsers fetch the new copy.
5. Commit and push **this** repo → updates v2.kitannn.com.

Never edit `data.js`, `cv.html`, `images/` or `assets/` in this repo directly — the next sync overwrites them.

## Content comes from the main site
`data.js`, `images/`, `assets/resume/` and `cv.html` are **copied from `../Portfolio`** — don't edit them here.
After changing content in `Portfolio/data.js` (or adding photos there), run:

```powershell
powershell -ExecutionPolicy Bypass -File .\sync.ps1
```

then commit and push this repo too. The sync mirrors folders, so images removed from Portfolio are removed here.
Large source originals (`birbKit.jpg`, `CC_KeyArt_*.png`) are skipped.

## Files
- `index.html` — page chrome (frame, clock, nav)
- `style.css` — theme tokens at the top
- `app.js` — hash router, pages, draggable windows, project modal
- `gl.js` — WebGL2 effects (grid, holo band, clouds, hover distortion) with CSS/SVG fallbacks

Bump the `?v=` numbers in `index.html` when you change CSS/JS so browsers don't serve stale copies.

## Local preview
```powershell
python -m http.server 8768 --directory .
```
then open http://localhost:8768/

## Swapping with the main site later
Put `kitannn.com` in this repo's `CNAME` and `v2.kitannn.com` in the old repo's, then update
Settings → Pages → Custom domain in both. No DNS changes needed.
