import type { ZodError } from "zod";
import type { JournalFrontmatter, Photo, Place } from "./content-schema";

export type ValidationIssue = {
  source?: string;
  path?: string;
  message: string;
};

export type ContentRecord<T> = {
  source: string;
  value: T;
};

export type JournalContentRecord = ContentRecord<JournalFrontmatter> & {
  photoIds: string[];
};

export type ContentGraph = {
  places: ContentRecord<Place>[];
  photos: ContentRecord<Photo>[];
  journals: JournalContentRecord[];
};

function fieldPath(path: (string | number)[]) {
  return path.reduce<string>((result, segment) =>
    typeof segment === "number" ? `${result}[${segment}]` : [result, segment].filter(Boolean).join("."), "");
}

export function issuesFromZod(error: ZodError, source?: string): ValidationIssue[] {
  return error.issues.map((issue) => ({
    source,
    path: fieldPath(issue.path),
    message: issue.message,
  }));
}

export function formatValidationIssue(issue: ValidationIssue) {
  const location = [issue.source, issue.path].filter(Boolean).join(":");
  return location ? `${location}: ${issue.message}` : issue.message;
}

export function summarizeValidationIssues(issues: ValidationIssue[], limit = 3) {
  const shown = issues.slice(0, limit).map(formatValidationIssue).join("；");
  const remaining = issues.length - limit;
  return remaining > 0 ? `${shown}；另有 ${remaining} 项` : shown;
}

function duplicateIssues<T>(records: ContentRecord<T>[], value: (record: T) => string, path: string, label: string) {
  const firstSourceByValue = new Map<string, string>();
  const issues: ValidationIssue[] = [];

  for (const record of records) {
    const key = value(record.value);
    const firstSource = firstSourceByValue.get(key);
    if (firstSource) {
      issues.push({
        source: record.source,
        path,
        message: `${label} “${key}” duplicates ${firstSource}`,
      });
    } else {
      firstSourceByValue.set(key, record.source);
    }
  }

  return issues;
}

export function validateContentGraph({ places, photos, journals }: ContentGraph): ValidationIssue[] {
  const issues = [
    ...duplicateIssues(places, (place) => place.id, "id", "Place id"),
    ...duplicateIssues(places, (place) => place.slug, "slug", "Place slug"),
    ...duplicateIssues(photos, (photo) => photo.id, "id", "Photo id"),
    ...duplicateIssues(journals, (journal) => journal.slug, "slug", "Journal slug"),
  ];
  const placeById = new Map(places.map((record) => [record.value.id, record]));
  const photoById = new Map(photos.map((record) => [record.value.id, record]));

  for (const record of places) {
    const place = record.value;
    if (place.parentId && !placeById.has(place.parentId)) {
      issues.push({ source: record.source, path: "parentId", message: `Unknown parent place “${place.parentId}”` });
    }
  }

  const reportedCycles = new Set<string>();
  for (const record of places) {
    const chain: string[] = [];
    let current: ContentRecord<Place> | undefined = record;
    while (current) {
      const cycleStart = chain.indexOf(current.value.id);
      if (cycleStart >= 0) {
        const cycle = [...chain.slice(cycleStart), current.value.id];
        const key = [...new Set(cycle)].sort().join("|");
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key);
          issues.push({ source: current.source, path: "parentId", message: `Place hierarchy contains a cycle: ${cycle.join(" -> ")}` });
        }
        break;
      }
      chain.push(current.value.id);
      current = current.value.parentId ? placeById.get(current.value.parentId) : undefined;
    }
  }

  for (const record of photos) {
    const photo = record.value;
    if (!placeById.has(photo.placeId)) {
      issues.push({ source: record.source, path: "placeId", message: `Unknown place “${photo.placeId}”` });
    }
  }

  for (const record of journals) {
    const journal = record.value;
    if (!placeById.has(journal.placeId)) {
      issues.push({ source: record.source, path: "placeId", message: `Unknown place “${journal.placeId}”` });
    }

    for (const photoId of record.photoIds) {
      const photo = photoById.get(photoId)?.value;
      if (!photo) {
        issues.push({ source: record.source, path: "article", message: `Unknown embedded photo “${photoId}”` });
      } else if (photo.placeId !== journal.placeId) {
        issues.push({
          source: record.source,
          path: "article",
          message: `Photo “${photo.id}” belongs to “${photo.placeId}”, not “${journal.placeId}”`,
        });
      }
    }
  }

  return issues;
}
