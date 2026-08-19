import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { z } from "zod";

const geoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1),
});
const geoJsonMultiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1)).min(1),
});

const placeSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  country: z.string().min(1),
  region: z.string().min(1).optional(),
  coordinates: z.object({
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
  }),
  geometry: z.union([geoJsonPolygonSchema, geoJsonMultiPolygonSchema]),
});

const photoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  alt: z.string().min(1),
  takenAt: z.string().date(),
  placeId: z.string().min(1),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive() }),
  media: z.object({ path: z.string().min(1), fallbackPath: z.string().min(1) }),
  rights: z.object({ notice: z.string().min(1), licenseUrl: z.string().url() }),
});

const journalSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  createdAt: z.string().date(),
  updatedAt: z.string().datetime({ offset: true }),
  tags: z.array(z.string().min(1)),
  placeId: z.string().min(1),
  coverPhotoId: z.string().min(1).optional(),
});

type Journal = z.infer<typeof journalSchema>;

function parseFrontmatter(file: string): Journal {
  const source = readFileSync(file, "utf8");
  const match = source.match(/export\s+const\s+frontmatter\s*=\s*(\{[\s\S]*?\})\s*;?/);
  if (!match) throw new Error(`Missing frontmatter export: ${file}`);

  try {
    const value = vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 1000 });
    return journalSchema.parse(value);
  } catch (error) {
    throw new Error(`Invalid journal frontmatter in ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const contentDir = join(process.cwd(), "content");
const placeFiles = readdirSync(join(contentDir, "places")).filter((file) => file.endsWith(".json"));
const photoFiles = readdirSync(join(contentDir, "photos")).filter((file) => file.endsWith(".json"));
const journalFiles = readdirSync(join(contentDir, "journals")).filter((file) => file.endsWith(".mdx"));

const places = placeFiles.map((file) => placeSchema.parse(JSON.parse(readFileSync(join(contentDir, "places", file), "utf8"))));
const photos = photoFiles.map((file) => photoSchema.parse(JSON.parse(readFileSync(join(contentDir, "photos", file), "utf8"))));
const journals = journalFiles.map((file) => {
  const path = join(contentDir, "journals", file);
  return { file: path, frontmatter: parseFrontmatter(path) };
});

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

assertUnique(places.map((place) => place.id), "place id");
assertUnique(places.map((place) => place.slug), "place slug");
assertUnique(photos.map((photo) => photo.id), "photo id");
assertUnique(journals.map(({ frontmatter }) => frontmatter.slug), "journal slug");

const placeIds = new Set(places.map((place) => place.id));
const photoById = new Map(photos.map((photo) => [photo.id, photo]));

for (const photo of photos) {
  if (!placeIds.has(photo.placeId)) throw new Error(`Photo ${photo.id} references unknown place: ${photo.placeId}`);
}

for (const { file, frontmatter } of journals) {
  if (!placeIds.has(frontmatter.placeId)) {
    throw new Error(`Journal ${frontmatter.slug} references unknown place: ${frontmatter.placeId}`);
  }
  if (frontmatter.coverPhotoId) {
    const cover = photoById.get(frontmatter.coverPhotoId);
    if (!cover) throw new Error(`Journal ${frontmatter.slug} references unknown cover photo: ${frontmatter.coverPhotoId}`);
    if (cover.placeId !== frontmatter.placeId) {
      throw new Error(`Journal ${frontmatter.slug} cover photo ${cover.id} belongs to ${cover.placeId}, not ${frontmatter.placeId}`);
    }
  }

  const source = readFileSync(file, "utf8");
  const embeds = [...source.matchAll(/<PhotoEmbed\b[^>]*\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  for (const photoId of embeds) {
    const photo = photoById.get(photoId);
    if (!photo) throw new Error(`Journal ${frontmatter.slug} embeds unknown photo: ${photoId}`);
    if (photo.placeId !== frontmatter.placeId) {
      throw new Error(`Journal ${frontmatter.slug} embeds photo ${photo.id} from another place: ${photo.placeId}`);
    }
  }
}

console.log(`Validated ${places.length} place(s), ${journals.length} journal(s), and ${photos.length} photo record(s).`);
