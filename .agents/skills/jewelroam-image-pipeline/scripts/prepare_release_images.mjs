#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname);

function usage() {
  console.error("Usage: prepare_release_images.mjs <slug> [--quality <0-100>] [--revision <token>] [--only <indices>]");
  process.exit(2);
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`${command} failed: ${detail}`);
  }
}

function orientation(file) {
  const raw = run("exiftool", ["-s3", "-Orientation#", file]);
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 8 ? value : 1;
}

function dimensions(file) {
  const output = run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]);
  const width = Number(output.match(/pixelWidth: (\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight: (\d+)/)?.[1]);
  if (!width || !height) throw new Error(`Could not read dimensions for ${file}`);
  return { width, height };
}

function normalizeJpeg(source, target, value) {
  const transform = {
    1: [],
    2: ["-flip", "horizontal"],
    3: ["-rotate", "180"],
    4: ["-flip", "vertical"],
    5: ["-transpose"],
    6: ["-rotate", "90"],
    7: ["-transverse"],
    8: ["-rotate", "270"],
  }[value];
  if (!transform) throw new Error(`Unsupported EXIF Orientation ${value}`);
  run("jpegtran", ["-copy", "none", ...transform, "-outfile", target, source]);
}

function verify(file) {
  const rawOrientation = run("exiftool", ["-s3", "-Orientation#", file]);
  if (rawOrientation) throw new Error(`Release file still has EXIF Orientation ${rawOrientation}: ${file}`);
  return dimensions(file);
}

const slug = process.argv[2];
if (!slug || slug.startsWith("-")) usage();
const quality = Number(option("--quality", "86"));
if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
  throw new Error("--quality must be an integer from 0 to 100");
}
const revision = option("--revision", "");
if (revision && !/^[A-Za-z0-9._-]+$/.test(revision)) {
  throw new Error("--revision may contain only letters, numbers, dots, underscores, and hyphens");
}
const only = String(option("--only", ""))
  .split(",")
  .filter(Boolean)
  .map((value) => Number(value));
if (only.some((value) => !Number.isInteger(value) || value <= 0)) {
  throw new Error("--only must be a comma-separated list of positive image indices");
}

const inbox = path.join(ROOT, "content", "inbox", slug);
const manifestPath = path.join(inbox, "image-manifest-draft.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!Array.isArray(manifest.images) || manifest.images.length === 0) {
  throw new Error(`No images found in ${path.relative(ROOT, manifestPath)}`);
}
const images = only.length
  ? manifest.images.filter((image) => only.includes(image.index))
  : manifest.images;
if (images.length === 0 || images.length !== only.length) {
  throw new Error(`--only selected images not present in ${path.relative(ROOT, manifestPath)}`);
}

const releaseDir = path.join(inbox, "release");
fs.mkdirSync(releaseDir, { recursive: true });
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jewelroam-release-"));
const results = [];

try {
  for (const image of images) {
    const source = path.join(inbox, image.filename);
    if (!fs.existsSync(source)) throw new Error(`Missing staged image: ${image.filename}`);
    if (path.extname(source).toLowerCase() !== ".jpeg" && path.extname(source).toLowerCase() !== ".jpg") {
      throw new Error(`Only JPEG sources are supported for release normalization: ${image.filename}`);
    }

    const id = `${slug}-${String(image.index).padStart(2, "0")}`;
    const releaseId = revision ? `${id}-${revision}` : id;
    const normalized = path.join(tempDir, `${releaseId}.jpg`);
    const jpgTemp = path.join(tempDir, `${releaseId}.release.jpg`);
    const webpTemp = path.join(tempDir, `${releaseId}.webp`);
    const originalOrientation = orientation(source);
    normalizeJpeg(source, normalized, originalOrientation);
    const normalizedDimensions = verify(normalized);

    run("jpegtran", ["-copy", "none", "-optimize", "-outfile", jpgTemp, normalized]);
    run("cwebp", ["-quiet", "-metadata", "none", "-q", String(quality), normalized, "-o", webpTemp]);
    const jpgDimensions = verify(jpgTemp);
    const webpDimensions = verify(webpTemp);
    if (JSON.stringify(jpgDimensions) !== JSON.stringify(normalizedDimensions)) {
      throw new Error(`JPEG dimensions changed unexpectedly for ${id}`);
    }
    if (JSON.stringify(webpDimensions) !== JSON.stringify(normalizedDimensions)) {
      throw new Error(`WebP dimensions changed unexpectedly for ${id}`);
    }

    fs.renameSync(jpgTemp, path.join(releaseDir, `${releaseId}.jpg`));
    fs.renameSync(webpTemp, path.join(releaseDir, `${releaseId}.webp`));
    results.push({ id, releaseId, originalOrientation, dimensions: normalizedDimensions });
  }
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({ slug, quality, revision: revision || null, imageCount: results.length, images: results }, null, 2));
