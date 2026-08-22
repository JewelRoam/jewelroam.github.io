#!/usr/bin/env node

import { access, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DEFAULTS = {
  bucket: "jewelroam-media",
  prefix: "upload/photos/2026",
  domain: "https://images.zer.dpdns.org",
};
const IMAGE_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
]);

function usage() {
  console.log(`Usage: npm run content:publish-r2 -- [options] <slug> [...slug]

Upload release images from content/inbox/<slug>/release/ to Cloudflare R2.

Options:
  --dry-run       Print the upload plan without changing R2
  --no-check      Skip public URL checks after upload
  --bucket NAME   R2 bucket (default: ${DEFAULTS.bucket})
  --prefix PATH   Object prefix (default: ${DEFAULTS.prefix})
  --domain URL    Public image domain (default: ${DEFAULTS.domain})
  --revision TAG  Upload only release files ending in -TAG
  -h, --help      Show this help
`);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS, dryRun: false, check: true, revision: "", slugs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-check") options.check = false;
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (["--bucket", "--prefix", "--domain", "--revision"].includes(arg)) {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.slugs.push(arg);
    }
  }
  return options;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function collectReleaseFiles(slug, revision = "") {
  const releaseDir = join(ROOT, "content", "inbox", slug, "release");
  await access(releaseDir).catch(() => {
    throw new Error(`Release directory not found: ${relative(ROOT, releaseDir)}`);
  });
  const entries = await readdir(releaseDir, { withFileTypes: true });
  const suffix = revision ? `-${revision}` : "";
  const releaseName = new RegExp(`^${escapeRegex(slug)}-\\d+${escapeRegex(suffix)}\\.jpe?g$`, "i");
  const files = entries
    .filter((entry) => entry.isFile() && IMAGE_TYPES.has(extname(entry.name).toLowerCase()))
    .filter((entry) => releaseName.test(entry.name))
    .map((entry) => ({
      slug,
      file: join(releaseDir, entry.name),
      name: entry.name,
      contentType: IMAGE_TYPES.get(extname(entry.name).toLowerCase()),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
  if (files.length === 0) throw new Error(`No matching .jpg release files found for ${slug}`);
  return files;
}

function objectKey(file, prefix) {
  return `${prefix.replace(/\/+$/, "")}/${file.name}`;
}

function publicUrl(domain, key) {
  return `${domain.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function runWrangler(args) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler exited with status ${result.status}`);
}

async function checkUrl(url) {
  const response = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return usage();
  if (options.slugs.length === 0) {
    usage();
    throw new Error("Provide at least one article slug");
  }

  const files = (await Promise.all(options.slugs.map((slug) => collectReleaseFiles(slug, options.revision)))).flat();
  const plan = files.map((file) => ({
    ...file,
    key: objectKey(file, options.prefix),
    url: publicUrl(options.domain, objectKey(file, options.prefix)),
  }));

  console.log(`${options.dryRun ? "[dry-run] " : ""}R2 bucket: ${options.bucket}`);
  console.log(`Object prefix: ${options.prefix}/`);
  console.log(`Files: ${plan.length}`);
  for (const item of plan) console.log(`  ${item.key} <- ${relative(ROOT, item.file)}`);
  if (options.dryRun) return;

  for (const item of plan) {
    runWrangler([
      "r2",
      "object",
      "put",
      `${options.bucket}/${item.key}`,
      "--remote",
      "--file",
      item.file,
      "--content-type",
      item.contentType,
      "--cache-control",
      "public, max-age=31536000, immutable",
      "--force",
    ]);
  }

  if (options.check) {
    console.log("Checking public URLs...");
    for (const item of plan) {
      await checkUrl(item.url);
      if (item.contentType === "image/jpeg") {
        await checkUrl(`${options.domain}/cdn-cgi/image/width=640,format=auto,quality=82/${item.key}`);
      }
      console.log(`  OK ${item.url}`);
    }
  }
  console.log(`Published ${plan.length} object(s).`);
}

main().catch((error) => {
  console.error(`R2 publish failed: ${error.message}`);
  process.exitCode = 1;
});
