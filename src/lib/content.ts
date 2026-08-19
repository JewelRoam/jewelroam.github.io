import type { ComponentType } from "react";
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

export type Photo = z.infer<typeof photoSchema>;

const postFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  createdAt: z.string().date(),
  updatedAt: z.string().datetime({ offset: true }),
  tags: z.array(z.string().min(1)),
  coverPhotoId: z.string().min(1).optional(),
});

type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

type PostModule = {
  default: ComponentType<Record<string, unknown>>;
  frontmatter: unknown;
};

type ParsedPostModule = Omit<PostModule, "frontmatter"> & { frontmatter: PostFrontmatter };

const photoModules = import.meta.glob("../../content/photos/*.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const photos = Object.values(photoModules).map((raw) => photoSchema.parse(JSON.parse(raw)));

const postModules = import.meta.glob("../../content/posts/*.mdx", { eager: true }) as Record<string, PostModule>;

export const posts: ParsedPostModule[] = Object.values(postModules)
  .map((post) => ({ ...post, frontmatter: postFrontmatterSchema.parse(post.frontmatter) }))
  .sort((a, b) => b.frontmatter.createdAt.localeCompare(a.frontmatter.createdAt));

export function getPhoto(id: string) {
  return photos.find((photo) => photo.id === id);
}

export function getPost(slug: string) {
  return posts.find((post) => post.frontmatter.slug === slug);
}

export function getSeriesPhotos(series: string) {
  return photos.filter((photo) => photo.series === series);
}
