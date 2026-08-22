# JewelRoam Metadata Schema

## Article frontmatter

Formal MDX under `content/journals/*.mdx` uses:

```ts
{
  slug: string;
  title: string;
  description: string;       // non-empty in the current app
  createdAt: "YYYY-MM-DD";
  updatedAt: ISO-8601 with timezone;
  placeId: string;            // exactly one place per Journal
  mediaLayout: "inline" | "gallery";
}
```

`createdAt` is editable in the local editor. `updatedAt` is generated when a changed draft is saved and should not be manually changed during review.

An editor export may contain a freely entered `placeName` with an empty `placeId` and `placeStatus: "needs-place-record"`. Treat this as a proposal: confirm the destination, create its formal Place record with coordinates and geometry, then replace it with the resulting `placeId` before publication.

## Place record

Each `content/places/*.json` record uses:

```ts
{
  id: string;
  slug: string;
  name: string;
  parentId?: string; // optional containing Place, for nested or overlapping locations
  country: string;
  region?: string;
  coordinates: { latitude: number; longitude: number };
  geometry: Polygon | MultiPolygon;
}
```

`parentId` expresses containment or archival hierarchy; it does not change the Journal contract, which still points to exactly one Place. Map rendering and hit testing use the most specific child Place when geometries overlap. Parent references must resolve and must not form cycles.

## Photo manifest

Each `content/photos/*.json` record requires:

```ts
{
  id: string;
  title: string;
  alt: string;
  takenAt: "YYYY-MM-DD";
  placeId: string;            // exactly one place per Photo
  dimensions: { width: number; height: number };
  media: { path: string; fallbackPath?: string };
  rights: {
    notice: string;
    licenseUrl: "https://jewelroam.github.io/rights";
  };
}
```

Dimensions, media paths, and image formats can be generated. Title, alt, date, `placeId`, and rights still need a reviewable value. Do not fill legal fields with guesses.

## Current project references

- Runtime schema: `src/lib/content-schema.ts`
- Content validation: `scripts/validate-content.ts`
- Publication workflow: `docs/codex/CONTENT_WORKFLOW.md`
- Public rights section and the only allowed published `licenseUrl`: `https://jewelroam.github.io/rights`
- Draft manifests may keep `rights.notice` and `rights.licenseUrl` empty while awaiting confirmation; empty draft values must never reach `content/photos/*.json`.
