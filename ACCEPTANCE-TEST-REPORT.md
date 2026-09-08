# v5.25 Acceptance Test Report

Photographic fixture inflated to: **8.83 MB** (4044×5393).

A browser execution test was attempted with the container Chromium binary, but Chromium cannot start headless correctly in this runtime (it also fails on a blank page). Therefore canvas/WebP device behavior still requires the manual browser/device checks listed below. Static code/syntax and compression-feasibility checks were completed.

## Compression feasibility using the same resolution/quality policy

| Profile | Result | Dimensions | Quality | Hard limit |
|---|---:|---:|---:|---:|
| listing | 97 KB | 1200×1600 | 0.82 | 500 KB |
| blog | 128 KB | 1440×1920 | 0.82 | 750 KB |
| avatar | 15 KB | 384×512 | 0.82 | 250 KB |

## Automated/static checks

- All JavaScript files pass `node --check`.
- No direct `db.storage.from(...)` calls remain in `app.js`, `admin.js`, or `newsletter.js`; UI storage operations are routed through `imageService`.
- New paths are UUID-based and extension comes from optimized output.
- Cache max-age is 31536000 seconds for new unique files.
- Listing optimization queue is capped at 2 workers and drops to 1 on <=4-core devices.
- Existing paths are only read; no image migration is performed.
- Admin listing deletion uses the deployed JWT-protected `admin-delete-listing` Edge Function.

## Manual device tests still required

1. Real 5 MB JPG on iPhone/desktop and inspect uploaded object size/type.
2. HEIC from iPhone (supported decode or clear compatibility error).
3. EXIF portrait orientation.
4. Five simultaneous listing images and UI responsiveness.
5. Listing deletion Storage cleanup.
6. Avatar replacement ordering/cleanup.
7. Pre-v5.25 images still render.
8. Safari/Chrome/PWA standalone + desktop browser.
