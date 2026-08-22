import { z } from "zod";

export const PUBLIC_RIGHTS_URL = "https://jewelroam.github.io/rights" as const;
export const MEDIA_LAYOUTS = ["inline", "gallery"] as const;
export type MediaLayout = (typeof MEDIA_LAYOUTS)[number];

export const articleImageSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image"),
  src: z.string().min(1),
  sourceName: z.string(),
  alt: z.string(),
  title: z.string(),
  caption: z.string(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
}).strict();

const articleDraftShape = {
  schemaVersion: z.literal(2),
  kind: z.literal("journal"),
  title: z.string(),
  description: z.string(),
  placeId: z.string(),
  placeName: z.string().min(1),
  placeStatus: z.enum(["existing", "needs-place-record"]),
  createdAt: z.string().date(),
  updatedAt: z.string().datetime({ offset: true }),
  exportedAt: z.string().datetime({ offset: true }),
  mediaLayout: z.enum(MEDIA_LAYOUTS),
  html: z.string(),
  gallery: z.array(articleImageSchema),
};

export const articleDraftSchema = z.object(articleDraftShape).strict().superRefine((draft, context) => {
  if (draft.placeStatus === "existing" && !draft.placeId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["placeId"], message: "Existing places require placeId" });
  }
  if (draft.placeStatus === "needs-place-record" && draft.placeId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["placeId"], message: "New places must not have placeId" });
  }
  if (draft.mediaLayout === "inline" && draft.gallery.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["gallery"], message: "Inline drafts must keep gallery empty" });
  }
});

export const storedDraftSchema = z.object({
  schemaVersion: z.literal(2),
  kind: z.literal("journal"),
  title: z.string(),
  description: z.string(),
  placeId: z.string(),
  placeName: z.string(),
  createdAt: z.string().date(),
  updatedAt: z.string().datetime({ offset: true }),
  mediaLayout: z.enum(MEDIA_LAYOUTS),
  html: z.string(),
  gallery: z.array(articleImageSchema),
}).strict();

const coordinatePairSchema = z.tuple([
  z.number().gte(-180).lte(180),
  z.number().gte(-90).lte(90),
]);

const ringSchema = z.array(coordinatePairSchema)
  .min(4)
  .refine(([first, ...rest]) => {
    const last = rest.at(-1);
    return Boolean(last && first[0] === last[0] && first[1] === last[1]);
  }, "Polygon rings must be closed");

const geoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(ringSchema).min(1),
}).strict();

const geoJsonMultiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(ringSchema).min(1)).min(1),
}).strict();

export const placeSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).optional(),
  country: z.string().min(1),
  region: z.string().min(1).optional(),
  coordinates: z.object({
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
  }).strict(),
  geometry: z.union([geoJsonPolygonSchema, geoJsonMultiPolygonSchema]),
}).strict();

export const photoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  alt: z.string().min(1),
  takenAt: z.string().date(),
  placeId: z.string().min(1),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
  media: z.object({ path: z.string().min(1), fallbackPath: z.string().min(1) }).strict(),
  rights: z.object({ notice: z.string().min(1), licenseUrl: z.literal(PUBLIC_RIGHTS_URL) }).strict(),
}).strict();

export const journalFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  createdAt: z.string().date(),
  updatedAt: z.string().datetime({ offset: true }),
  placeId: z.string().min(1),
  mediaLayout: z.enum(MEDIA_LAYOUTS),
}).strict();

export type Place = z.infer<typeof placeSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type JournalFrontmatter = z.infer<typeof journalFrontmatterSchema>;
export type ArticleImage = z.infer<typeof articleImageSchema>;
export type ArticleDraft = z.infer<typeof articleDraftSchema>;
export type StoredDraft = z.infer<typeof storedDraftSchema>;
