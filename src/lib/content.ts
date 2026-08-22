import type { ComponentType } from "react";
import { z } from "zod";
import { MEDIA_LAYOUTS } from "./article-document";

export const PUBLIC_RIGHTS_URL = "https://jewelroam.github.io/rights" as const;

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
  parentId: z.string().min(1).optional(),
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
  rights: z.object({ notice: z.string().min(1), licenseUrl: z.literal(PUBLIC_RIGHTS_URL) }),
});

const journalFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  createdAt: z.string().date(),
  updatedAt: z.string().datetime({ offset: true }),
  tags: z.array(z.string().min(1)),
  placeId: z.string().min(1),
  coverPhotoId: z.string().min(1).optional(),
  mediaLayout: z.enum(MEDIA_LAYOUTS).default("inline"),
});

export type Place = z.infer<typeof placeSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type JournalFrontmatter = z.infer<typeof journalFrontmatterSchema>;

type JournalModule = {
  default: ComponentType<Record<string, unknown>>;
  frontmatter: unknown;
};

export type ParsedJournalModule = Omit<JournalModule, "frontmatter"> & {
  frontmatter: JournalFrontmatter;
};

const placeModules = import.meta.glob("../../content/places/*.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const places: Place[] = Object.values(placeModules)
  .map((raw) => placeSchema.parse(JSON.parse(raw)))
  .sort((a, b) => a.name.localeCompare(b.name));

const photoModules = import.meta.glob("../../content/photos/*.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const photos: Photo[] = Object.values(photoModules).map((raw) => photoSchema.parse(JSON.parse(raw)));

const journalModules = import.meta.glob("../../content/journals/*.mdx", { eager: true }) as Record<string, JournalModule>;

export const journals: ParsedJournalModule[] = Object.values(journalModules)
  .map((journal) => ({ ...journal, frontmatter: journalFrontmatterSchema.parse(journal.frontmatter) }))
  .sort((a, b) => b.frontmatter.createdAt.localeCompare(a.frontmatter.createdAt));

export function getPlace(idOrSlug: string) {
  return places.find((place) => place.id === idOrSlug || place.slug === idOrSlug);
}

export function getPhoto(id: string) {
  return photos.find((photo) => photo.id === id);
}

export function getJournal(slug: string) {
  return journals.find((journal) => journal.frontmatter.slug === slug);
}

export function getPlacePhotos(placeId: string) {
  return photos.filter((photo) => photo.placeId === placeId);
}

export function getPlaceJournals(placeId: string) {
  return journals.filter((journal) => journal.frontmatter.placeId === placeId);
}
