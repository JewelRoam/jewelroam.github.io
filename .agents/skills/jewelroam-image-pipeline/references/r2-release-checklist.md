# JewelRoam R2 Release Checklist

## Project contract

- Bucket: `jewelroam-media`
- Public custom domain: `https://images.zer.dpdns.org`
- Image transformation prefix: `https://images.zer.dpdns.org/cdn-cgi/image/width=640,format=auto,quality=82/...`
- Staging directory: `content/inbox/`
- Formal photo records: `content/photos/*.json`
- Formal Journals: `content/journals/*.mdx`
- Formal places: `content/places/*.json`
- Published photo `rights.licenseUrl`: `https://jewelroam.github.io/rights` (the only allowed value)

## Required photo record

```json
{
  "id": "stable-id",
  "title": "confirmed display title",
  "alt": "confirmed accessible description",
  "takenAt": "YYYY-MM-DD",
  "placeId": "confirmed-place-id",
  "dimensions": { "width": 1600, "height": 1067 },
  "media": {
    "path": "photos/YYYY/stable-id.jpg"
  },
  "rights": {
    "notice": "confirmed copyright notice",
    "licenseUrl": "https://jewelroam.github.io/rights"
  }
}
```

Keep the private source image separate from the one public, full-size JPEG in R2. Cloudflare Image Transformations generate browser-sized responses on demand; do not upload pre-generated WebP derivatives for the normal workflow.

Before publishing, run `npm run content:prepare-release -- <slug>` to normalize any EXIF orientation into the pixel data, preserve an ICC profile when present, and strip EXIF/XMP metadata. Verify the public JPEG's physical width/height; do not carry raw sensor dimensions into metadata when a portrait image is stored in a rotated landscape raster.

R2 release URLs are immutable. When replacing an already published object, use a new filename revision (for example `--revision r2 --only 05,11`) and update the corresponding formal photo records before publishing; do not overwrite an immutable URL and expect its cache to refresh. `media.fallbackPath` is optional because the canonical full-size JPEG is also the browser fallback.

## Release order

1. Confirm article text, description, dates, all Journal places, each photo's actual place, rights, and the exact set of files to publish.
2. Generate formal manifests and MDX references.
3. Run `npm run content:validate`, `npm run typecheck`, and `npm run build`.
4. Upload only the approved release files to `jewelroam-media`.
5. Verify each public URL and transformed URL.
6. Publish the GitHub change after the R2 objects are available, so the site never points at missing objects.
7. Archive or remove inbox copies only after verification and only with explicit authorization.
