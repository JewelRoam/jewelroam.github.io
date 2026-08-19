---
name: jewelroam-image-pipeline
description: Stage and validate JewelRoam images from editor-exported JSON, HTML with embedded data URLs, or an image inbox. Use when extracting images, generating a draft manifest and MDX preview, checking dimensions/size/format, preparing Cloudflare R2 publication, or diagnosing missing media; never upload or expose files before explicit confirmation.
---

# JewelRoam Image Pipeline

Run the deterministic staging step first, then complete metadata review, local validation, and only then the separately authorized R2 upload. This skill is a pre-publication workflow; it does not grant permission to upload, delete, or publish anything.

## Stage an Editor Export

Use the bundled script with an explicit output directory:

```bash
node .agents/skills/jewelroam-image-pipeline/scripts/stage_article_draft.mjs \
  /absolute/path/article-draft.json \
  --output /absolute/path/project/content/inbox/article-slug \
  --slug article-slug
```

The default per-image limit is 100 MiB. Override it only when the user explicitly chooses a different limit with `--max-image-mb N`.

The script produces:

- `images/NN-source-name.ext`: decoded local image files;
- `source-article.json`: source fields with embedded payloads removed;
- `image-manifest-draft.json`: dimensions, byte sizes, source names, blank review fields, and `status: needs-confirmation`;
- `article-preview.mdx`: article text with `PhotoEmbed` references for local review only.

Do not treat `article-preview.mdx` as publishable while its description, `placeId`, or photo metadata is incomplete. Keep staging files under `content/inbox/`; do not place them under `content/journals/`, `content/places/`, or `content/photos/` yet.

## Preflight

1. Confirm every staged file exists, is an allowed image type, and is within the selected size limit.
2. Confirm the number and order of `PhotoEmbed` references matches the manifest.
3. Run the project's content validation and production build.
4. Read [references/r2-release-checklist.md](references/r2-release-checklist.md) before generating formal manifests or upload commands.
5. Stop and report missing metadata, unconfirmed rights, missing R2 objects, or a blank article description. Do not silently substitute values.

## R2 Gate

R2 upload is a separate action. Require an immediate user confirmation that names the exact image set, destination bucket/domain, and public release scope. Before that confirmation, do not call an R2 upload command, create public URLs, delete inbox files, or modify published content.

After confirmation, create the formal `content/photos/*.json`, update the MDX under `content/journals/`, ensure its single `placeId` exists in `content/places/`, upload the approved release files to the configured R2 bucket, verify the public custom-domain URLs, and rerun validation/build. Report the exact objects and URLs changed.
