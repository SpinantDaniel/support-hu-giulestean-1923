# HUB Giuleștean — Image Optimization v5.25

## Upload profiles

| Area | Max dimensions | Target | Hard limit | Preferred output |
|---|---:|---:|---:|---|
| Marketplace | 1600×1600 | ~240 KB | 500 KB | WebP |
| Blog | 1920×1920 | ~340 KB | 750 KB | WebP |
| Avatar | 512×512 | ~110 KB | 250 KB | WebP |

Quality ladder: `0.82 → 0.75 → 0.68`.

If the target is still missed, the service tries controlled dimension steps `100% → 90% → 82%` of the already capped size. If the result still exceeds the hard limit, upload is rejected with a clear message instead of uploading the original.

## Storage abstraction

All new frontend upload/delete/public-URL calls go through `imageService`:

- `imageService.optimize()`
- `imageService.optimizeMany()`
- `imageService.upload()`
- `imageService.delete()`
- `imageService.getPublicUrl()`
- `imageService.uniquePath()`

The provider registry currently exposes `supabase`. A future `r2` provider can be added without changing marketplace/blog/profile UI flows.

## Error/cleanup model

- Optimization happens before upload.
- Original file is never uploaded when optimization succeeds.
- New storage file is deleted if the following DB operation fails.
- Failed deletes are retried and persisted to a small local cleanup queue for retry on the next authenticated app/admin load.
- Existing image paths are never migrated or renamed automatically.

## Manual device acceptance tests

1. Upload a ~5 MB JPG in Marketplace. Confirm Storage object is `.webp`, ≤500 KB, normally ~150–300 KB.
2. Select a HEIC from iPhone. If Safari can decode it, confirm WebP upload; otherwise confirm the explicit HEIC compatibility error.
3. Upload portrait iPhone photo with EXIF orientation. Confirm upright portrait in card, detail modal and lightbox.
4. Upload 5 listing photos together. Confirm progress `Se optimizează imaginile… X/5`, then `Se încarcă imaginile… X/5`, with responsive UI.
5. Delete a listing and verify its object paths disappear from `listing-images`.
6. Replace avatar; confirm new avatar first, DB updated, old object removed only afterward.
7. Open old listings/blog posts created before v5.25 and verify images continue to load unchanged.
8. Repeat listing/blog/avatar tests on iPhone standalone app, Safari/Chrome, and desktop browser.
