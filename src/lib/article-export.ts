import type { JournalFrontmatter } from "./content";
import { articleDraftSchema, type ArticleDraft, type ArticleImage } from "./content-schema";
import { replaceArticleMediaWithImages } from "./article-document";
import justifiedLayout from "justified-layout";

export type ExportRatio = "1:1" | "2:3" | "3:4" | "9:16";
export type ExportFormat = "png" | "jpg" | "pdf";
export type ExportSettings =
  | { mode: "ratio"; ratio: ExportRatio; format: ExportFormat }
  | { mode: "count"; pageCount: number; format: ExportFormat };

export type ExportProgress = {
  stage: "loading-images" | "building-layout" | "rendering" | "packing";
  current?: number;
  total?: number;
};

export type JournalExportInput = {
  slug: string;
  frontmatter: JournalFrontmatter;
  placeNames?: string[];
  article: HTMLElement;
};

type ProgressHandler = (progress: ExportProgress) => void;

const EXPORT_PADDING_X = 84;
const EXPORT_PADDING_Y = 88;
const EXPORT_WIDTH = 1080;
const IMAGE_LOAD_TIMEOUT = 15000;
const IMAGE_FETCH_TIMEOUT = 15000;
const RATIO_SIZES: Record<ExportRatio, { width: number; height: number }> = {
  "1:1": { width: 1440, height: 1440 },
  "2:3": { width: 1200, height: 1800 },
  "3:4": { width: 1440, height: 1920 },
  "9:16": { width: 1080, height: 1920 },
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);
    try {
      const response = await fetch(candidate, { mode: "cors", signal: controller.signal });
      if (!response.ok) continue;
      return dataUrlFromBlob(await response.blob());
    } catch {
      // Image Transform responses may not forward the bucket CORS headers.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return src;
}

function sourceName(image: HTMLImageElement, index: number) {
  return image.alt || image.title || `image-${String(index + 1).padStart(2, "0")}`;
}

async function prepareArticleClone(article: HTMLElement, onProgress?: ProgressHandler) {
  const clone = article.cloneNode(true) as HTMLElement;
  const images = [...clone.querySelectorAll("img")];
  const resolved: ArticleImage[] = [];

  for (let start = 0; start < images.length; start += 4) {
    const batch = images.slice(start, start + 4);
    const dataUrls = await Promise.all(batch.map((image) => {
      const src = image.getAttribute("src") || image.currentSrc;
      return src ? resolveImageSource(src) : Promise.resolve("");
    }));
    batch.forEach((image, offset) => {
      const index = start + offset;
      const dataUrl = dataUrls[offset];
      if (!dataUrl) return;
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
    });
    onProgress?.({ stage: "loading-images", current: Math.min(start + batch.length, images.length), total: images.length });
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

export function getExportPageCountLimit(article: HTMLElement) {
  let blockCount = 0;
  let imageCount = 0;
  const flushImages = () => {
    blockCount += Math.ceil(imageCount / 6);
    imageCount = 0;
  };

  for (const block of exportBlocks(article)) {
    const images = block.querySelectorAll("img").length;
    const mediaBlock = block.classList.contains("article-media")
      || block.classList.contains("article-media__link")
      || (images > 0 && !block.textContent?.trim());
    if (mediaBlock) {
      imageCount += images;
    } else {
      flushImages();
      blockCount += 1;
    }
  }
  flushImages();
  return Math.max(1, Math.min(18, blockCount));
}

function createExportStage(width: number) {
  const stage = document.createElement("div");
  stage.className = "article-export-stage";
  stage.style.width = `${width}px`;
  document.body.append(stage);
  return stage;
}

function createPage(stage: HTMLElement, width: number, height: number) {
  const page = document.createElement("div");
  page.className = "article-export-page";
  page.style.height = `${height}px`;
  page.style.padding = `${EXPORT_PADDING_Y * (width / EXPORT_WIDTH)}px ${EXPORT_PADDING_X * (width / EXPORT_WIDTH)}px`;
  page.style.width = `${width}px`;
  page.style.setProperty("--export-scale", String(width / EXPORT_WIDTH));
  const content = document.createElement("div");
  content.className = "article-export-page__content";
  content.style.height = `${height - EXPORT_PADDING_Y * 2 * (width / EXPORT_WIDTH)}px`;
  content.style.width = `${width - EXPORT_PADDING_X * 2 * (width / EXPORT_WIDTH)}px`;
  page.append(content);
  stage.append(page);
  return { page, content };
}

function imageAspectRatio(image: HTMLImageElement) {
  const width = image.naturalWidth || Number(image.getAttribute("width"));
  const height = image.naturalHeight || Number(image.getAttribute("height"));
  return width > 0 && height > 0 ? width / height : 1;
}

function createImageGroup(images: HTMLImageElement[], contentWidth: number) {
  const geometry = justifiedLayout(images.map(imageAspectRatio), {
    containerWidth: contentWidth,
    targetRowHeight: Math.max(260, Math.min(430, contentWidth / 2.5)),
    boxSpacing: 20,
    containerPadding: 0,
    showWidows: true,
  });
  const group = document.createElement("div");
  group.className = "article-export-image-group";
  const hasCaptions = images.some((image) => image.closest("figure")?.querySelector("figcaption")?.textContent?.trim());
  group.style.height = `${geometry.containerHeight + (hasCaptions ? 24 : 0)}px`;
  group.style.width = `${contentWidth}px`;

  geometry.boxes.forEach((box: { left: number; top: number; width: number; height: number }, index: number) => {
    const item = document.createElement("figure");
    item.className = "article-export-image-item";
    item.style.height = `${box.height}px`;
    item.style.left = `${box.left}px`;
    item.style.top = `${box.top}px`;
    item.style.width = `${box.width}px`;
    const image = images[index].cloneNode(true) as HTMLImageElement;
    image.removeAttribute("srcset");
    image.style.height = "100%";
    image.style.maxHeight = "none";
    image.style.width = "100%";
    const caption = images[index].closest("figure")?.querySelector("figcaption")?.textContent?.trim();
    item.append(image);
    if (caption) {
      const figcaption = document.createElement("figcaption");
      figcaption.textContent = caption;
      item.append(figcaption);
    }
    group.append(item);
  });

  return group;
}

function createFlowBlocks(article: HTMLElement, contentWidth: number) {
  const blocks: HTMLElement[] = [];
  let imageRun: HTMLImageElement[] = [];
  const flushImages = () => {
    for (let index = 0; index < imageRun.length; index += 6) {
      blocks.push(createImageGroup(imageRun.slice(index, index + 6), contentWidth));
    }
    imageRun = [];
  };

  for (const block of exportBlocks(article)) {
    const images = [...block.querySelectorAll<HTMLImageElement>("img")];
    const mediaBlock = block.classList.contains("article-media")
      || block.classList.contains("article-media__link")
      || (images.length > 0 && !block.textContent?.trim());
    if (mediaBlock) {
      imageRun.push(...images);
      continue;
    }
    flushImages();
    blocks.push(block.cloneNode(true) as HTMLElement);
  }
  flushImages();
  return blocks;
}

function blockHeight(block: HTMLElement) {
  const marginBottom = Number.parseFloat(getComputedStyle(block).marginBottom) || 0;
  return block.getBoundingClientRect().height + marginBottom;
}

function createRatioPages(stage: HTMLElement, blocks: HTMLElement[], size: { width: number; height: number }) {
  const pages = [];
  let current = createPage(stage, size.width, size.height);
  pages.push(current.page);
  for (const block of blocks) {
    current.content.append(block);
    if (current.content.scrollHeight > current.content.clientHeight && current.content.children.length > 1) {
      current.content.removeChild(block);
      current = createPage(stage, size.width, size.height);
      pages.push(current.page);
      current.content.append(block);
    }
  }
  return pages;
}

function createCountPages(stage: HTMLElement, blocks: HTMLElement[], pageCount: number, width: number) {
  const measure = createPage(stage, width, 100000);
  measure.page.classList.add("article-export-page--measure");
  measure.page.style.height = "auto";
  measure.content.style.height = "auto";
  blocks.forEach((block) => measure.content.append(block));
  const heights = blocks.map(blockHeight);
  const measuredHeights = new Map(blocks.map((block, index) => [block, heights[index]]));
  measure.page.remove();

  const pageTotal = Math.max(1, Math.min(Math.floor(pageCount), blocks.length || 1));
  const groups: HTMLElement[][] = [];
  let start = 0;
  let remainingHeight = heights.reduce((sum, height) => sum + height, 0);

  for (let pageIndex = 0; pageIndex < pageTotal; pageIndex += 1) {
    const pagesLeft = pageTotal - pageIndex;
    if (pagesLeft === 1) {
      groups.push(blocks.slice(start));
      break;
    }

    const targetHeight = remainingHeight / pagesLeft;
    const lastAllowedIndex = blocks.length - pagesLeft;
    let end = start + 1;
    let groupHeight = heights[start];
    while (end <= lastAllowedIndex) {
      const nextHeight = groupHeight + heights[end];
      if (Math.abs(nextHeight - targetHeight) > Math.abs(groupHeight - targetHeight)) break;
      groupHeight = nextHeight;
      end += 1;
    }
    groups.push(blocks.slice(start, end));
    start = end;
    remainingHeight -= groupHeight;
  }

  const pages = groups.map((group) => {
    const height = group.reduce((sum, block) => sum + (measuredHeights.get(block) ?? 0), 0) + EXPORT_PADDING_Y * 2;
    const current = createPage(stage, width, Math.max(height, 320 + EXPORT_PADDING_Y * 2));
    group.forEach((block) => current.content.append(block));
    return current.page;
  });
  return { pages };
}

async function waitForImages(root: HTMLElement) {
  const images = [...root.querySelectorAll<HTMLImageElement>("img")];
  await Promise.all(images.map((image) => {
    if (!image.src) return Promise.resolve();
    if (image.complete) {
      return image.naturalWidth > 0
        ? Promise.resolve()
        : Promise.reject(new Error("有图片无法加载，导出已停止"));
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("图片加载超时，导出已停止"));
      }, IMAGE_LOAD_TIMEOUT);
      const finish = (reason?: Error) => {
        window.clearTimeout(timeout);
        if (reason) reject(reason);
        else resolve();
      };
      image.addEventListener("load", () => finish(), { once: true });
      image.addEventListener("error", () => finish(new Error("有图片无法加载，导出已停止")), { once: true });
    });
  }));
}

async function createExportPages(article: HTMLElement, settings: ExportSettings, requireDataUrls: boolean, onProgress?: ProgressHandler) {
  const prepared = await prepareArticleClone(article, onProgress);
  const clonedImages = [...prepared.clone.querySelectorAll<HTMLImageElement>("img")];
  if (requireDataUrls && clonedImages.some((image) => !image.src.startsWith("data:"))) {
    throw new Error("视觉导出需要图片域名允许跨域读取，请先为 R2 配置 CORS");
  }

  // Wait before measuring so justified layout receives real image dimensions.
  await waitForImages(prepared.clone);
  await document.fonts?.ready;
  const size = settings.mode === "ratio" ? RATIO_SIZES[settings.ratio] : { width: EXPORT_WIDTH, height: 0 };
  const contentWidth = size.width - EXPORT_PADDING_X * 2 * (size.width / EXPORT_WIDTH);
  const stage = createExportStage(size.width);
  try {
    onProgress?.({ stage: "building-layout" });
    const blocks = createFlowBlocks(prepared.clone, contentWidth);
    const pages = settings.mode === "ratio"
      ? createRatioPages(stage, blocks, size)
      : createCountPages(stage, blocks, settings.pageCount, size.width).pages;
    await waitForImages(stage);
    return { stage, pages, width: size.width };
  } catch (reason) {
    stage.remove();
    throw reason;
  }
}

async function renderPages(
  pages: HTMLElement[],
  width: number,
  format: Extract<ExportFormat, "png" | "jpg">,
  onProgress?: ProgressHandler,
) {
  const { toJpeg, toPng } = await import("html-to-image");
  const render = format === "jpg" ? toJpeg : toPng;
  const images: { image: string; height: number }[] = [];
  for (const [index, page] of pages.entries()) {
    onProgress?.({ stage: "rendering", current: index + 1, total: pages.length });
    const height = Math.ceil(page.getBoundingClientRect().height);
    images.push({
      image: await render(page, {
        backgroundColor: "#f5f3ee",
        cacheBust: true,
        height,
        pixelRatio: 1,
        quality: format === "jpg" ? 0.92 : undefined,
        width,
      }),
      height,
    });
  }
  return images;
}

export async function exportJournalPdf(input: JournalExportInput, settings: ExportSettings, onProgress?: ProgressHandler) {
  const prepared = await createExportPages(input.article, settings, true, onProgress);
  try {
    const images = await renderPages(prepared.pages, prepared.width, "png", onProgress);
    const { jsPDF } = await import("jspdf");
    const maxHeight = Math.max(...images.map((entry) => entry.height));
    const pdfScale = Math.min(0.75, 14000 / Math.max(prepared.width, maxHeight));
    const pdfWidth = prepared.width * pdfScale;
    const pdf = new jsPDF({
      compress: true,
      format: [pdfWidth, images[0].height * pdfScale],
      orientation: prepared.width >= images[0].height ? "landscape" : "portrait",
      unit: "pt",
    });
    images.forEach(({ image, height }, index) => {
      const pdfHeight = height * pdfScale;
      if (index > 0) pdf.addPage([pdfWidth, pdfHeight], prepared.width >= height ? "landscape" : "portrait");
      pdf.addImage(image, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
    });
    onProgress?.({ stage: "packing", current: 1, total: 1 });
    pdf.save(`${input.slug}.pdf`);
  } finally {
    prepared.stage.remove();
  }
}

export async function exportJournalVisual(input: JournalExportInput, settings: ExportSettings, onProgress?: ProgressHandler) {
  if (settings.format === "pdf") {
    await exportJournalPdf(input, settings, onProgress);
    return;
  }

  const [{ default: JSZip }] = await Promise.all([import("jszip")]);
  const prepared = await createExportPages(input.article, settings, true, onProgress);
  try {
    const images = await renderPages(prepared.pages, prepared.width, settings.format, onProgress);
    const zip = new JSZip();
    onProgress?.({ stage: "packing", current: 0, total: 1 });
    images.forEach(({ image }, index) => {
      zip.file(`${String(index + 1).padStart(3, "0")}.${settings.format}`, image.split(",")[1], { base64: true });
    });
    downloadBlob(await zip.generateAsync({ type: "blob" }), `${input.slug}-${settings.format}.zip`);
    onProgress?.({ stage: "packing", current: 1, total: 1 });
  } finally {
    prepared.stage.remove();
  }
}
