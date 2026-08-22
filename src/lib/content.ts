import type { ComponentType } from "react";
import type { ZodError } from "zod";
import {
  journalFrontmatterSchema,
  photoSchema,
  placeSchema,
  type JournalFrontmatter,
  type Photo,
  type Place,
} from "./content-schema";
import { issuesFromZod, summarizeValidationIssues } from "./content-validation";

export type { JournalFrontmatter, Photo, Place } from "./content-schema";

type JournalModule = {
  default: ComponentType<Record<string, unknown>>;
  frontmatter: unknown;
};

export type ParsedJournalModule = Omit<JournalModule, "frontmatter"> & {
  frontmatter: JournalFrontmatter;
};

function parseContent<T>(schema: {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: ZodError };
}, value: unknown, source: string) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(`内容数据无效：${summarizeValidationIssues(issuesFromZod(result.error, source))}`);
}

function parseJson(raw: string, source: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`内容数据无效：${source}: JSON 解析失败（${error instanceof Error ? error.message : String(error)}）`);
  }
}

const placeModules = import.meta.glob("../../content/places/*.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const places: Place[] = Object.entries(placeModules)
  .map(([source, raw]) => parseContent(placeSchema, parseJson(raw, source), source))
  .sort((a, b) => a.name.localeCompare(b.name));

const photoModules = import.meta.glob("../../content/photos/*.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const photos: Photo[] = Object.entries(photoModules)
  .map(([source, raw]) => parseContent(photoSchema, parseJson(raw, source), source));

const journalModules = import.meta.glob("../../content/journals/*.mdx", { eager: true }) as Record<string, JournalModule>;

export const journals: ParsedJournalModule[] = Object.entries(journalModules)
  .map(([source, journal]) => ({
    ...journal,
    frontmatter: parseContent<JournalFrontmatter>(journalFrontmatterSchema, journal.frontmatter, source),
  }))
  .sort((a, b) => b.frontmatter.createdAt.localeCompare(a.frontmatter.createdAt));

export function getPlace(idOrSlug: string) {
  return places.find((place) => place.id === idOrSlug || place.slug === idOrSlug);
}

export function getPlaces(ids: string[]) {
  return ids.map((id) => getPlace(id)).filter((place): place is Place => Boolean(place));
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
  return journals.filter((journal) => journal.frontmatter.placeIds.includes(placeId));
}
