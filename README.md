# kitannn° portfolio v2

A window/desktop-style redesign (inspired by 109ichiki.com) with birbKit as the centerpiece.
Deploys to **https://kitannn.com** via GitHub Pages (`CNAME` file in this repo). The classic site lives at v2.kitannn.com.

## ✏️ Updating content later (checklist)

1. Edit content in the **main site**: `E:\Dev\Kitannn\Portfolio\data.js` (text, work entries, responsibilities),
   and add/replace photos in `Portfolio\images\` or the résumé in `Portfolio\assets\resume\`.
2. Commit and push the **Portfolio** repo → updates the classic site at v2.kitannn.com.
3. In this folder, copy the changes over:
   ```powershell
   cd E:\Dev\Kitannn\Portfolio-v2
   powershell -ExecutionPolicy Bypass -File .\sync.ps1
   ```
4. If you changed `data.js`, bump `data.js?v=N` in `index.html` so browsers fetch the new copy.
5. Commit and push **this** repo → updates kitannn.com.

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
- `app.js` — hash router, loading screen + intro, draggable lens windows, cloud physics, VCR works reel, project modal
- `gl.js` — WebGL2 effects (warped grid, raymarched clouds, VCR playback, hover distortion) with CSS/SVG fallbacks

Bump the `?v=` numbers in `index.html` when you change CSS/JS so browsers don't serve stale copies.

## Local preview
```powershell
python -m http.server 8768 --directory .
```
then open http://localhost:8768/

## Domains
Swapped on 2026-09-17: this repo serves **kitannn.com**, the classic `kitannn.github.io` repo serves **v2.kitannn.com**.
A domain can only belong to one repo at a time, so to swap back: first change **this** repo's `CNAME` and
Settings → Pages → Custom domain to `v2.kitannn.com`, then change the classic repo's to `kitannn.com`.
DNS never needs to change.
