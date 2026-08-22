import { z } from "zod";

export const MEDIA_LAYOUTS = ["inline", "gallery"] as const;
export type MediaLayout = (typeof MEDIA_LAYOUTS)[number];

const articleImageSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image").default("image"),
  src: z.string().min(1),
  sourceName: z.string().default(""),
  alt: z.string().default(""),
  title: z.string().default(""),
  caption: z.string().default(""),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

export const articleDraftSchema = z.object({
  schemaVersion: z.number().int().positive().default(2),
  kind: z.literal("journal").default("journal"),
  title: z.string().default(""),
  description: z.string().default(""),
  placeId: z.string().default(""),
  placeName: z.string().default(""),
  placeStatus: z.enum(["existing", "needs-place-record"]).default("needs-place-record"),
  createdAt: z.string().default(""),
  updatedAt: z.string().default(""),
  exportedAt: z.string().default(""),
  mediaLayout: z.enum(MEDIA_LAYOUTS).default("inline"),
  html: z.string().default(""),
  gallery: z.array(articleImageSchema).default([]),
});

export type ArticleImage = z.infer<typeof articleImageSchema>;
export type ArticleDraft = z.infer<typeof articleDraftSchema>;

export function parseArticleDraft(value: unknown): ArticleDraft {
  return articleDraftSchema.parse(value);
}

function imageNode(image: ArticleImage) {
  const img = document.createElement("img");
  img.src = image.src;
  img.alt = image.alt || image.sourceName;
  if (image.title) img.title = image.title;
  img.dataset.assetId = image.id;
  return img;
}

function parseHtml(html: string) {
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;
}

export function extractImagesFromHtml(html: string) {
  const body = parseHtml(html);
  const images: ArticleImage[] = [];

  body.querySelectorAll("img").forEach((img, index) => {
    const id = img.dataset.assetId || `image-${String(index + 1).padStart(2, "0")}`;
    images.push({
      id,
      type: "image",
      src: img.currentSrc || img.getAttribute("src") || "",
      sourceName: img.getAttribute("alt") || img.getAttribute("title") || id,
      alt: img.getAttribute("alt") || "",
      title: img.getAttribute("title") || "",
      caption: "",
      width: img.width || undefined,
      height: img.height || undefined,
    });

    const wrapper = img.closest("figure, .article-media, a");
    (wrapper ?? img).remove();
  });

  return { html: body.innerHTML, images };
}

export function appendImagesToHtml(html: string, images: ArticleImage[]) {
  const body = parseHtml(html);
  images.forEach((image) => {
    const paragraph = document.createElement("p");
    paragraph.append(imageNode(image));
    body.append(paragraph);
  });
  return body.innerHTML;
}

export function replaceArticleMediaWithImages(html: string) {
  const body = parseHtml(html);
  body.querySelectorAll(".article-media").forEach((media) => {
    const img = media.querySelector("img");
    if (!img) return media.remove();
    const paragraph = document.createElement("p");
    paragraph.append(img.cloneNode(true));
    media.replaceWith(paragraph);
  });
  return body.innerHTML;
}
