import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const photoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  alt: z.string().min(1),
  takenAt: z.string().date(),
  location: z.string().min(1),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive() }),
  media: z.object({ path: z.string().min(1), fallbackPath: z.string().min(1) }),
  series: z.string().min(1),
  rights: z.object({ notice: z.string().min(1), licenseUrl: z.string().url() }),
});

const photoDir = join(process.cwd(), "content/photos");
const files = readdirSync(photoDir).filter((file) => file.endsWith(".json"));
const ids = new Set<string>();

for (const file of files) {
  const value = photoSchema.parse(JSON.parse(readFileSync(join(photoDir, file), "utf8")));
  if (ids.has(value.id)) throw new Error(`Duplicate photo id: ${value.id}`);
  ids.add(value.id);
}

console.log(`Validated ${files.length} photo record(s).`);
