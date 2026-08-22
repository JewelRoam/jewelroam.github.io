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
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}

function safeName(name, index, extension) {
  const base = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${String(index).padStart(2, "0")}-${base || `image-${String(index).padStart(2, "0")}.${extension}`}`;
}

const input = process.argv[2];
const output = option("--output");
if (!input || !output) usage();

const maxImageMb = Number(option("--max-image-mb", "100"));
if (!Number.isFinite(maxImageMb) || maxImageMb <= 0) throw new Error("--max-image-mb must be a positive number");
const maxImageBytes = maxImageMb * 1024 * 1024;
const draft = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
if (typeof draft.html !== "string") throw new Error("Draft must contain an html string");

const outputDir = path.resolve(output);
const imageDir = path.join(outputDir, "images");
fs.mkdirSync(imageDir, { recursive: true });

let imageIndex = 0;
const images = [];
const sourceHtml = draft.html.replace(/<img\b[^>]*>/gi, (tag) => {
  imageIndex += 1;
  const attrs = attributes(tag);
  const match = String(attrs.src ?? "").match(/^data:(image\/[\w.+-]+);base64,([\s\S]*)$/);
  if (!match || !ALLOWED_TYPES.has(match[1])) throw new Error(`Image ${imageIndex} is missing an allowed base64 image source`);

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > maxImageBytes) {
    throw new Error(`Image ${imageIndex} is ${(bytes.length / 1048576).toFixed(2)} MiB, above the ${maxImageMb} MiB limit`);
  }

  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const filename = safeName(attrs.alt || attrs.title || "", imageIndex, extension);
  const filePath = path.join(imageDir, filename);
  fs.writeFileSync(filePath, bytes);
  const id = `image-${String(imageIndex).padStart(2, "0")}`;
  images.push({
    index: imageIndex,
    id,
    sourceName: attrs.alt || attrs.title || filename,
    filename: `images/${filename}`,
    mime: match[1],
    bytes: bytes.length,
    dimensions: dimensions(filePath),
    title: "",
    alt: "",
    takenAt: "",
    placeId: draft.placeId ?? "",
    placeName: draft.placeName ?? "",
    // Rights stay pending in drafts; confirmed published records use the project Rights page.
    rights: { notice: "", licenseUrl: "" },
  });
  return `@@IMAGE_${String(imageIndex).padStart(2, "0")}@@`;
});

const slug = option("--slug", `article-${draft.createdAt || "draft"}`);
const body = sourceHtml
  .replace(/<p>([\s\S]*?)<\/p>/gi, "$1\n\n")
  .replace(/<[^>]+>/g, "")
  .replace(/@@IMAGE_(\d{2})@@/g, (_, index) => `\n<PhotoEmbed id="${slug}-${index}" />\n`)
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const source = {
  title: draft.title ?? "",
  description: draft.description ?? "",
  placeId: draft.placeId ?? "",
  placeName: draft.placeName ?? "",
  createdAt: draft.createdAt ?? "",
  updatedAt: draft.updatedAt ?? "",
  exportedAt: draft.exportedAt ?? "",
  html: sourceHtml,
};
const manifest = {
  status: "needs-confirmation",
  slug,
  articleTitle: source.title,
  description: source.description,
  createdAt: source.createdAt,
  updatedAt: source.updatedAt,
  proposedPlace: { id: source.placeId || null, name: source.placeName, status: source.placeId ? "existing" : "needs-place-record" },
  images: images.map((image) => ({ ...image, id: `${slug}-${String(image.index).padStart(2, "0")}` })),
  missingFields: [
    ...(source.description ? [] : ["article.description"]),
    ...(source.placeId ? [] : ["article.placeId"]),
    "images[].title",
    "images[].alt",
    "images[].takenAt",
    ...(source.placeId ? [] : ["images[].placeId"]),
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
  "  tags: [],",
  `  placeId: ${JSON.stringify(source.placeId ?? "")},`,
  `  coverPhotoId: ${JSON.stringify(`${slug}-01`)},`,
  "};",
  "",
  'import { PhotoEmbed } from "../../../src/components/PhotoEmbed";',
  "",
].join("\n");

fs.writeFileSync(path.join(outputDir, "source-article.json"), `${JSON.stringify(source, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "image-manifest-draft.json"), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "article-preview.mdx"), `${frontmatter}${body}\n`);

console.log(JSON.stringify({ output: outputDir, imageCount: images.length, totalBytes: images.reduce((sum, image) => sum + image.bytes, 0), status: manifest.status }, null, 2));
