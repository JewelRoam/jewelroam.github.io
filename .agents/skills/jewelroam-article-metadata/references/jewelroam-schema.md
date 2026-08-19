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
  tags: string[];
  placeId: string;            // exactly one place per Journal
  coverPhotoId?: string;
}
```

`createdAt` is editable in the local editor. `updatedAt` is generated when a changed draft is saved and should not be manually changed during review.

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
  media: { path: string; fallbackPath: string };
  rights: { notice: string; licenseUrl: valid URL };
}
```

Dimensions, media paths, and image formats can be generated. Title, alt, date, `placeId`, and rights still need a reviewable value. Do not fill legal fields with guesses.

## Current project references

- Runtime schema: `src/lib/content.ts`
- Photo validation: `scripts/validate-content.ts`
- Publication workflow: `docs/codex/CONTENT_WORKFLOW.md`
- Public rights page: `https://jewelroam.github.io/rights`
