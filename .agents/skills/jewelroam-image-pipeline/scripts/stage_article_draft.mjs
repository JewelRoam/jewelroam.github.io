#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function usage() {
  console.error("Usage: stage_article_draft.mjs <draft.json> --output <directory> [--slug <slug>] [--max-image-mb <number>]");
  process.exit(2);
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    result[match[1]] = match[3] ?? match[4] ?? "";
  }
  return result;
}

function dimensions(file) {
  try {
    const output = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
    const width = Number(output.match(/pixelWidth: (\d+)/)?.[1]);
    const height = Number(output.match(/pixelHeight: (\d+)/)?.[1]);
    const orientation = execFileSync("sips", ["-g", "orientation", file], { encoding: "utf8" })
      .match(/orientation: (.+)/)?.[1]?.trim();
    const rotated = orientation === "upper-right" || orientation === "lower-left";
    return width > 0 && height > 0
      ? rotated
        ? { width: height, height: width }
        : { width, height }
      : null;
  } catch {
    return null;
  }
}

function safeName(name, index, extension) {
  const base = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${String(index).padStart(2, "0")}-${base || `image-${String(index).padStart(2, "0")}.${extension}`}`;
}

function remoteImage(rawSource) {
  const pathname = new URL(rawSource).pathname.toLowerCase();
  const extension = pathname.match(/\.(jpe?g|png|webp|gif|avif)$/)?.[1] ?? "jpeg";
  const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
  const bytes = execFileSync("curl", ["-fsSL", "--max-time", "60", rawSource]);
  return { mime, bytes };
}

const input = process.argv[2];
const output = option("--output");
if (!input || !output) usage();

const maxImageMb = Number(option("--max-image-mb", "100"));
if (!Number.isFinite(maxImageMb) || maxImageMb <= 0) throw new Error("--max-image-mb must be a positive number");
const maxImageBytes = maxImageMb * 1024 * 1024;
const draft = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
const requiredDraftFields = [
  "schemaVersion",
  "kind",
  "title",
  "description",
  "createdAt",
  "updatedAt",
  "exportedAt",
  "mediaLayout",
  "html",
  "gallery",
];
for (const field of requiredDraftFields) {
  if (!(field in draft)) throw new Error(`Draft is missing required field: ${field}`);
}
if (![2, 3].includes(draft.schemaVersion) || draft.kind !== "journal") throw new Error("Draft must use schemaVersion 3 and kind journal");
if (!['inline', 'gallery'].includes(draft.mediaLayout)) throw new Error("Draft mediaLayout must be inline or gallery");
if (!Array.isArray(draft.gallery)) throw new Error("Draft gallery must be an array");
for (const field of ["title", "description", "createdAt", "updatedAt", "exportedAt", "html"]) {
  if (typeof draft[field] !== "string") throw new Error(`Draft field ${field} must be a string`);
}
const draftPlaces = draft.schemaVersion === 3
  ? draft.places
  : [{ id: draft.placeId, name: draft.placeName }];
if (!Array.isArray(draftPlaces) || !draftPlaces.length) throw new Error("Draft must contain at least one place");
for (const [index, place] of draftPlaces.entries()) {
  if (!place || typeof place !== "object" || typeof place.id !== "string" || typeof place.name !== "string" || !place.name.trim()) {
    throw new Error(`Draft places[${index}] must contain an id and name`);
  }
}
for (const [index, image] of draft.gallery.entries()) {
  if (!image || typeof image !== "object") throw new Error(`Draft gallery[${index}] must be an object`);
  for (const field of ["id", "type", "src", "sourceName", "alt", "title", "caption"]) {
    if (typeof image[field] !== "string") throw new Error(`Draft gallery[${index}].${field} must be a string`);
  }
  if (image.type !== "image") throw new Error(`Draft gallery[${index}].type must be image`);
}
if (draft.mediaLayout === "inline" && draft.gallery.length) throw new Error("Inline drafts must keep gallery empty");
const overridePlaceId = option("--place-id", "");
const overridePlaceName = option("--place-name", "");
const places = overridePlaceId
  ? [{ id: overridePlaceId, name: overridePlaceName || draftPlaces[0].name }]
  : draftPlaces.map((place) => ({ id: place.id, name: place.name.trim() }));
const placeIds = places.filter((place) => place.id).map((place) => place.id);
const placeNames = places.map((place) => place.name);
const mediaLayout = draft.mediaLayout;
const gallery = draft.gallery;

const outputDir = path.resolve(output);
const imageDir = path.join(outputDir, "images");
fs.mkdirSync(imageDir, { recursive: true });

let imageIndex = 0;
const images = [];
const galleryHtml = mediaLayout === "gallery"
  ? gallery.map((image) => `<img src=${JSON.stringify(image.src)} alt=${JSON.stringify(image.alt)} title=${JSON.stringify(image.title)}>`).join("")
  : "";
const sourceHtml = `${draft.html}${galleryHtml}`.replace(/<img\b[^>]*>/gi, (tag) => {
  imageIndex += 1;
  const attrs = attributes(tag);
  const rawSource = String(attrs.src ?? "");
  const match = rawSource.match(/^data:(image\/[\w.+-]+);base64,([\s\S]*)$/);
  const source = match
    ? { mime: match[1], bytes: Buffer.from(match[2], "base64") }
    : remoteImage(rawSource);
  if (!ALLOWED_TYPES.has(source.mime)) throw new Error(`Image ${imageIndex} has an unsupported image type: ${source.mime}`);

  const bytes = source.bytes;
  if (bytes.length > maxImageBytes) {
    throw new Error(`Image ${imageIndex} is ${(bytes.length / 1048576).toFixed(2)} MiB, above the ${maxImageMb} MiB limit`);
  }

  const extension = source.mime.split("/")[1].replace("jpeg", "jpg");
  const filename = safeName(attrs.alt || attrs.title || "", imageIndex, extension);
  const filePath = path.join(imageDir, filename);
  fs.writeFileSync(filePath, bytes);
  const id = `image-${String(imageIndex).padStart(2, "0")}`;
  images.push({
    index: imageIndex,
    id,
    sourceName: attrs.alt || attrs.title || filename,
    filename: `images/${filename}`,
    mime: source.mime,
    bytes: bytes.length,
    dimensions: dimensions(filePath),
    title: "",
    alt: "",
    takenAt: "",
    placeIds,
    placeNames,
    // Rights stay pending in drafts; confirmed published records use the project Rights page.
    rights: { notice: "", licenseUrl: "" },
  });
  return `@@IMAGE_${String(imageIndex).padStart(2, "0")}@@`;
});

const slug = option("--slug", `article-${draft.createdAt}`);
const bodySource = sourceHtml
  .replace(/<p>([\s\S]*?)<\/p>/gi, "$1\n\n")
  .replace(/<[^>]+>/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
const imageIds = images.map((image) => `${slug}-${String(image.index).padStart(2, "0")}`);
const body = mediaLayout === "gallery"
  ? `${bodySource.replace(/@@IMAGE_(\d{2})@@/g, "").trim()}\n\n<PhotoGallery ids={${JSON.stringify(imageIds)}} />`
  : bodySource.replace(/@@IMAGE_(\d{2})@@/g, (_, index) => `\n<PhotoEmbed id="${slug}-${index}" />\n`);

const source = {
  schemaVersion: 3,
  kind: draft.kind,
  title: draft.title,
  description: draft.description,
  places,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  exportedAt: draft.exportedAt,
  mediaLayout,
  html: sourceHtml,
  gallery: gallery.map((image, index) => ({
    id: image.id,
    type: image.type,
    sourceName: image.sourceName,
    alt: image.alt,
    title: image.title,
    caption: image.caption,
    filename: images[index]?.filename ?? "",
  })),
};
const manifest = {
  status: "needs-confirmation",
  slug,
  articleTitle: source.title,
  description: source.description,
  createdAt: source.createdAt,
  updatedAt: source.updatedAt,
  proposedPlaces: source.places.map((place) => ({ ...place, id: place.id || null, status: place.id ? "existing" : "needs-place-record" })),
  images: images.map((image) => ({ ...image, id: `${slug}-${String(image.index).padStart(2, "0")}` })),
  missingFields: [
    ...(source.description ? [] : ["article.description"]),
    ...(source.places.every((place) => place.id) ? [] : ["article.places[].id"]),
    "images[].title",
    "images[].alt",
    "images[].takenAt",
    "images[].placeId",
    "images[].rights.notice",
    "images[].rights.licenseUrl",
  ],
};
const frontmatter = [
  "export const frontmatter = {",
  `  slug: ${JSON.stringify(slug)},`,
  `  title: ${JSON.stringify(source.title)},`,
  `  description: ${JSON.stringify(source.description)},`,
  `  createdAt: ${JSON.stringify(source.createdAt)},`,
  `  updatedAt: ${JSON.stringify(source.updatedAt)},`,
  `  mediaLayout: ${JSON.stringify(source.mediaLayout)},`,
  `  placeIds: ${JSON.stringify(source.places.filter((place) => place.id).map((place) => place.id))}`,
  "};",
  "",
  mediaLayout === "gallery"
    ? 'import { PhotoGallery } from "../../../src/components/ArticleMedia";'
    : 'import { PhotoEmbed } from "../../../src/components/PhotoEmbed";',
  "",
].join("\n");

fs.writeFileSync(path.join(outputDir, "source-article.json"), `${JSON.stringify(source, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "image-manifest-draft.json"), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "article-preview.mdx"), `${frontmatter}${body}\n`);

console.log(JSON.stringify({ output: outputDir, imageCount: images.length, totalBytes: images.reduce((sum, image) => sum + image.bytes, 0), status: manifest.status }, null, 2));
