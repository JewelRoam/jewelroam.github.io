import type { JournalFrontmatter } from "./content";
import { articleDraftSchema, type ArticleDraft, type ArticleImage } from "./content-schema";
import { replaceArticleMediaWithImages } from "./article-document";

type JournalExportInput = {
  slug: string;
  frontmatter: JournalFrontmatter;
  placeNames?: string[];
  article: HTMLElement;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function dataUrlFromBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function originalImageSource(src: string) {
  const marker = "/cdn-cgi/image/";
  const markerIndex = src.indexOf(marker);
  if (markerIndex < 0) return "";

  const transformedPath = src.slice(markerIndex + marker.length);
  const pathStart = transformedPath.indexOf("/");
  if (pathStart < 0) return "";

  return `${src.slice(0, markerIndex)}/${transformedPath.slice(pathStart + 1)}`;
}

async function resolveImageSource(src: string) {
  if (src.startsWith("data:")) return src;

  const candidates = [src, originalImageSource(src)].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { mode: "cors" });
      if (!response.ok) continue;
      return dataUrlFromBlob(await response.blob());
    } catch {
      // Image Transform responses may not forward the bucket CORS headers.
    }
  }

  return src;
}

function sourceName(image: HTMLImageElement, index: number) {
  return image.alt || image.title || `image-${String(index + 1).padStart(2, "0")}`;
}

async function prepareArticleClone(article: HTMLElement) {
  const clone = article.cloneNode(true) as HTMLElement;
  const images = [...clone.querySelectorAll("img")];
  const resolved: ArticleImage[] = [];

  for (const [index, image] of images.entries()) {
    const src = image.getAttribute("src") || image.currentSrc;
    if (!src) continue;
    const dataUrl = await resolveImageSource(src);
    const id = image.dataset.assetId || `image-${String(index + 1).padStart(2, "0")}`;
    image.src = dataUrl;
    image.removeAttribute("srcset");
    image.dataset.assetId = id;
    resolved.push({
      id,
      type: "image",
      src: dataUrl,
      sourceName: sourceName(image, index),
      alt: image.alt,
      title: image.title,
      caption: image.closest("figure")?.querySelector("figcaption")?.textContent?.trim() || "",
      width: image.naturalWidth || undefined,
      height: image.naturalHeight || undefined,
    });
  }

  return { clone, images: resolved };
}

export async function createJournalDraft({ slug, frontmatter, placeNames, article }: JournalExportInput): Promise<ArticleDraft> {
  const prose = article.querySelector<HTMLElement>(".prose-jewel");
  if (!prose) throw new Error("找不到文章正文");

  const { clone, images } = await prepareArticleClone(prose);
  const layout = frontmatter.mediaLayout;

  if (layout === "gallery") {
    clone.querySelectorAll("img").forEach((image) => {
      (image.closest(".article-media") ?? image).remove();
    });
  }

  const html = layout === "inline" ? replaceArticleMediaWithImages(clone.innerHTML) : clone.innerHTML;
  return articleDraftSchema.parse({
    schemaVersion: 3,
    kind: "journal",
    title: frontmatter.title,
    description: frontmatter.description,
    places: frontmatter.placeIds.map((id, index) => ({ id, name: placeNames?.[index] ?? id })),
    createdAt: frontmatter.createdAt,
    updatedAt: frontmatter.updatedAt,
    exportedAt: new Date().toISOString(),
    mediaLayout: layout,
    html,
    gallery: layout === "gallery" ? images : [],
  });
}

export async function exportJournalJson(input: JournalExportInput) {
  const draft = await createJournalDraft(input);
  downloadBlob(
    new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }),
    `${input.slug}.json`,
  );
}

function exportBlocks(article: HTMLElement) {
  const prose = article.querySelector<HTMLElement>(".prose-jewel");
  if (!prose) return [];
  const source = [...article.children].flatMap((child) =>
    child === prose ? [...prose.children] : [child],
  );
  return source.flatMap((element) => {
    if (!element.classList.contains("article-media--gallery")) return [element];
    return [...element.children];
  });
}

function createExportStage() {
  const stage = document.createElement("div");
  stage.className = "article-export-stage";
  document.body.append(stage);
  return stage;
}

function createPage(stage: HTMLElement) {
  const page = document.createElement("div");
  page.className = "article-export-page";
  const content = document.createElement("div");
  content.className = "article-export-page__content";
  page.append(content);
  stage.append(page);
  return { page, content };
}

async function createExportPages(article: HTMLElement, requireDataUrls = false) {
  const prepared = await prepareArticleClone(article);
  if (requireDataUrls && prepared.images.some((image) => !image.src.startsWith("data:"))) {
    throw new Error("PNG 导出需要图片域名允许跨域读取，请先为 R2 配置 CORS");
  }

  await document.fonts?.ready;
  const stage = createExportStage();
  try {
    const blocks = exportBlocks(prepared.clone);
    let current = createPage(stage);

    for (const block of blocks) {
      const clone = block.cloneNode(true) as HTMLElement;
      current.content.append(clone);
      const hasImage = Boolean(clone.querySelector("img"));
      if (current.content.scrollHeight > current.content.clientHeight && current.content.children.length > 1) {
        current.content.removeChild(clone);
        current = createPage(stage);
        current.content.append(clone);
      }
      if (hasImage && clone.getBoundingClientRect().height > current.content.clientHeight) {
        clone.querySelectorAll("img").forEach((image) => {
          image.style.maxHeight = "1500px";
        });
      }
    }

    return stage;
  } catch (reason) {
    stage.remove();
    throw reason;
  }
}

export async function exportJournalPdf(article: HTMLElement) {
  const stage = await createExportPages(article);
  const cleanup = () => {
    stage.remove();
    delete document.documentElement.dataset.printing;
  };

  document.documentElement.dataset.printing = "true";
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => window.print(), 0);
}

export async function exportJournalPng(input: JournalExportInput) {
  const [{ toPng }, { default: JSZip }] = await Promise.all([
    import("html-to-image"),
    import("jszip"),
  ]);
  const stage = await createExportPages(input.article, true);
  try {
    const zip = new JSZip();
    const pages = [...stage.querySelectorAll<HTMLElement>(".article-export-page")];
    for (const [index, page] of pages.entries()) {
      const png = await toPng(page, {
        cacheBust: true,
        width: 1080,
        height: 1920,
        pixelRatio: 1,
      });
      zip.file(`${String(index + 1).padStart(3, "0")}.png`, png.split(",")[1], { base64: true });
    }
    downloadBlob(await zip.generateAsync({ type: "blob" }), `${input.slug}-png.zip`);
  } finally {
    stage.remove();
  }
}
