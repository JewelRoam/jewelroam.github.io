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
    "path": "photos/YYYY/stable-id.webp",
    "fallbackPath": "photos/YYYY/stable-id.jpg"
  },
  "rights": {
    "notice": "confirmed copyright notice",
    "licenseUrl": "https://jewelroam.github.io/rights"
  }
}
```

Generate WebP or other release derivatives only after preserving the original and confirming the intended public quality. Keep original and release paths explicit.

Before generating WebP, run `npm run content:prepare-release -- <slug>` to normalize any EXIF orientation into the pixel data and strip the orientation tag. Verify the release derivative's physical width/height with an image inspector; do not carry raw sensor dimensions into metadata when a portrait image is stored in a rotated landscape raster. Never use `cwebp -metadata none` directly on a JPEG that still has an Orientation tag.

R2 release URLs are immutable. When replacing an already published object, use a new filename revision (for example `--revision r2 --only 05,11`) and update the corresponding formal photo records before publishing; do not overwrite an immutable URL and expect its cache to refresh.

## Release order

1. Confirm article text, description, dates, image metadata, rights, and the exact set of files to publish.
2. Generate formal manifests and MDX references.
3. Run `npm run content:validate`, `npm run typecheck`, and `npm run build`.
4. Upload only the approved release files to `jewelroam-media`.
5. Verify each public URL and transformed URL.
6. Publish the GitHub change after the R2 objects are available, so the site never points at missing objects.
7. Archive or remove inbox copies only after verification and only with explicit authorization.
