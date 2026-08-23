import type { JournalFrontmatter } from "./content";
import { articleDraftSchema, type ArticleDraft, type ArticleImage } from "./content-schema";
import { replaceArticleMediaWithImages } from "./article-document";
import justifiedLayout from "justified-layout";

export type ExportRatio = "1:1" | "2:3" | "3:4" | "9:16";
export type ExportFormat = "png" | "jpg" | "pdf";
export type ExportSettings =
  | { mode: "ratio"; ratio: ExportRatio; format: ExportFormat }
  | { mode: "count"; pageCount: number; format: ExportFormat };

type ExportProgressStage =
  | "validating"
  | "loading-images"
  | "decoding-images"
  | "building-layout"
  | "rendering"
  | "serializing"
  | "packing"
  | "downloading";

type CountedProgressStage = Exclude<ExportProgressStage, "validating" | "building-layout">;

export type ExportProgress =
  | { stage: "validating" | "building-layout" }
  | { stage: CountedProgressStage; current: number; total: number };

export type JournalExportInput = {
  slug: string;
  frontmatter: JournalFrontmatter;
  placeNames?: string[];
  article: HTMLElement;
};

export type ExportProgressHandler = (progress: ExportProgress) => void;

const EXPORT_PADDING_X = 84;
const EXPORT_PADDING_Y = 88;
const EXPORT_WIDTH = 1080;
const IMAGE_LOAD_TIMEOUT = 15000;
const IMAGE_FETCH_TIMEOUT = 15000;
const JSON_STREAM_THRESHOLD = 64 * 1024 * 1024;
const RATIO_SIZES: Record<ExportRatio, { width: number; height: number }> = {
  "1:1": { width: 1440, height: 1440 },
  "2:3": { width: 1200, height: 1800 },
  "3:4": { width: 1440, height: 1920 },
  "9:16": { width: 1080, height: 1920 },
};

function downloadBlob(blob: Blob, filename: string) {
  if (!document.body) throw new Error("当前页面无法创建下载文件");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function* jsonStringChunks(value: string) {
  yield '"';
  for (let start = 0; start < value.length; start += 64 * 1024) {
    const encoded = JSON.stringify(value.slice(start, start + 64 * 1024));
    if (encoded === undefined) throw new TypeError("无法编码 JSON 字符串");
    yield encoded.slice(1, -1);
  }
  yield '"';
}

function* jsonChunks(value: unknown, depth = 0, stack = new Set<object>()): Generator<string> {
  if (value === null) {
    yield "null";
    return;
  }

  if (typeof value === "string") {
    yield* jsonStringChunks(value);
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError("无法编码 JSON 值");
    yield encoded;
    return;
  }

  if (typeof value !== "object") throw new TypeError("文章内容包含无法转换为 JSON 的值");
  if (stack.has(value)) throw new TypeError("文章内容包含循环引用");
  stack.add(value);

  const indent = "  ".repeat(depth);
  const nextIndent = "  ".repeat(depth + 1);
  if (Array.isArray(value)) {
    yield "[";
    for (const [index, item] of value.entries()) {
      if (index) yield ",";
      yield `\n${nextIndent}`;
      yield* jsonChunks(item, depth + 1, stack);
    }
    if (value.length) yield `\n${indent}`;
    yield "]";
  } else {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined && typeof item !== "function" && typeof item !== "symbol");
    yield "{";
    for (const [index, [key, item]] of entries.entries()) {
      if (index) yield ",";
      yield `\n${nextIndent}`;
      yield* jsonStringChunks(key);
      yield ": ";
      yield* jsonChunks(item, depth + 1, stack);
    }
    if (entries.length) yield `\n${indent}`;
    yield "}";
  }

  stack.delete(value);
}

type JsonWritable = {
  write(data: string): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
};

type JsonFileHandle = {
  createWritable(): Promise<JsonWritable>;
};

type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<JsonFileHandle>;

function estimateJsonSize(value: unknown, seen = new Set<object>()): number {
  if (value === null) return 4;
  if (typeof value === "string") return value.length + 2;
  if (typeof value === "number" || typeof value === "boolean") return String(value).length;
  if (typeof value !== "object" || seen.has(value)) return 0;

  seen.add(value);
  if (Array.isArray(value)) {
    const size = 2 + value.reduce((sum, item) => sum + estimateJsonSize(item, seen) + 1, 0);
    seen.delete(value);
    return size;
  }

  const size = Object.entries(value).reduce((sum, [key, item]) => (
    sum + key.length + 4 + estimateJsonSize(item, seen) + 1
  ), 2);
  seen.delete(value);
  return size;
}

function browserFilePicker() {
  return (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
}

function isAbortError(reason: unknown) {
  return reason instanceof DOMException && reason.name === "AbortError";
}

async function streamJsonToFile(value: unknown, filename: string) {
  const showSaveFilePicker = browserFilePicker();
  if (!showSaveFilePicker) return false;

  let handle: JsonFileHandle;
  try {
    handle = await showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "JSON 文件", accept: { "application/json": [".json"] } }],
    });
  } catch (reason) {
    if (isAbortError(reason)) throw new Error("已取消导出");
    throw reason;
  }

  const writable = await handle.createWritable();
  try {
    let chunkCount = 0;
    for (const chunk of jsonChunks(value)) {
      await writable.write(chunk);
      chunkCount += 1;
      if (chunkCount % 32 === 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    }
    await writable.close();
    return true;
  } catch (reason) {
    await writable.abort(reason).catch(() => undefined);
    throw reason;
  }
}

function jsonFileError(reason: unknown) {
  if (reason instanceof Error && reason.message === "已取消导出") return reason;
  const detail = reason instanceof Error ? reason.message : String(reason);
  return new Error(`无法写入 JSON 文件${detail ? `：${detail}` : ""}`);
}

export async function downloadJson(value: unknown, filename: string) {
  const estimatedSize = estimateJsonSize(value);
  if (estimatedSize >= JSON_STREAM_THRESHOLD && browserFilePicker()) {
    try {
      await streamJsonToFile(value, filename);
    } catch (reason) {
      throw jsonFileError(reason);
    }
    return;
  }

  let chunks: string[];
  try {
    chunks = [];
    let chunkCount = 0;
    for (const chunk of jsonChunks(value)) {
      chunks.push(chunk);
      chunkCount += 1;
      if (chunkCount % 64 === 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    }
  } catch (reason) {
    throw new Error(`文章内容无法转换为 JSON：${reason instanceof Error ? reason.message : String(reason)}`);
  }

  try {
    downloadBlob(new Blob(chunks, { type: "application/json" }), filename);
  } catch (reason) {
    if (estimatedSize >= JSON_STREAM_THRESHOLD && browserFilePicker()) {
      try {
        await streamJsonToFile(value, filename);
      } catch (streamReason) {
        throw jsonFileError(streamReason);
      }
      return;
    }
    throw new Error(`JSON 文件过大，当前浏览器无法完成下载（约 ${Math.ceil(estimatedSize / 1048576)} MB）`);
  }
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

async function prepareArticleClone(article: HTMLElement, onProgress?: ExportProgressHandler, requireDataUrls = false) {
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
      if (requireDataUrls && !dataUrl.startsWith("data:")) {
        throw new Error(`第 ${index + 1} 张图片无法读取，JSON 导出需要内嵌图片`);
      }
      const id = image.dataset.assetId || `image-${String(index + 1).padStart(2, "0")}`;
      image.src = dataUrl;
      image.loading = "eager";
      image.decoding = "sync";
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

async function createJournalDraft(
  { slug, frontmatter, placeNames, article }: JournalExportInput,
  onProgress?: ExportProgressHandler,
): Promise<ArticleDraft> {
  const prose = article.querySelector<HTMLElement>(".prose-jewel");
  if (!prose) throw new Error("找不到文章正文");

  const { clone, images } = await prepareArticleClone(prose, onProgress, true);
  await waitForImages(clone, (current, total) => {
    onProgress?.({ stage: "decoding-images", current, total });
  });
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

export async function exportJournalJson(input: JournalExportInput, onProgress?: ExportProgressHandler) {
  onProgress?.({ stage: "validating" });
  const draft = await createJournalDraft(input, onProgress);
  onProgress?.({ stage: "serializing", current: 1, total: 1 });
  onProgress?.({ stage: "downloading", current: 0, total: 1 });
  await downloadJson(draft, `${input.slug}.json`);
  onProgress?.({ stage: "downloading", current: 1, total: 1 });
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

async function waitForImages(root: HTMLElement, onDecodeProgress?: (current: number, total: number) => void) {
  const images = [...root.querySelectorAll<HTMLImageElement>("img")];
  let decoded = 0;
  onDecodeProgress?.(0, images.length);
  await Promise.all(images.map(async (image) => {
    if (!image.src) return Promise.resolve();
    image.loading = "eager";
    if (!image.complete) {
      await new Promise<void>((resolve, reject) => {
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
    }
    if (image.naturalWidth === 0) {
      throw new Error("有图片无法加载，导出已停止");
    }
    try {
      await image.decode();
    } catch {
      throw new Error("有图片无法解码，导出已停止");
    }
    decoded += 1;
    onDecodeProgress?.(decoded, images.length);
  }));
}

async function createExportPages(article: HTMLElement, settings: ExportSettings, requireDataUrls: boolean, onProgress?: ExportProgressHandler) {
  const prepared = await prepareArticleClone(article, onProgress);
  const clonedImages = [...prepared.clone.querySelectorAll<HTMLImageElement>("img")];
  if (requireDataUrls && clonedImages.some((image) => !image.src.startsWith("data:"))) {
    throw new Error("视觉导出需要图片域名允许跨域读取，请先为 R2 配置 CORS");
  }

  // Wait before measuring so justified layout receives real image dimensions.
  await waitForImages(prepared.clone, (current, total) => {
    onProgress?.({ stage: "decoding-images", current, total });
  });
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
  onProgress?: ExportProgressHandler,
) {
  const { toJpeg, toPng } = await import("html-to-image");
  const render = format === "jpg" ? toJpeg : toPng;
  const images: { image: string; height: number }[] = [];
  for (const [index, page] of pages.entries()) {
    onProgress?.({ stage: "rendering", current: index + 1, total: pages.length });
    await waitForImages(page);
    const height = Math.ceil(page.getBoundingClientRect().height);
    images.push({
      image: await render(page, {
        backgroundColor: "#f5f3ee",
        cacheBust: false,
        height,
        pixelRatio: 1,
        quality: format === "jpg" ? 0.92 : undefined,
        skipFonts: true,
        width,
      }),
      height,
    });
  }
  return images;
}

async function exportJournalPdf(input: JournalExportInput, settings: ExportSettings, onProgress?: ExportProgressHandler) {
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
    onProgress?.({ stage: "downloading", current: 0, total: 1 });
    pdf.save(`${input.slug}.pdf`);
    onProgress?.({ stage: "downloading", current: 1, total: 1 });
  } finally {
    prepared.stage.remove();
  }
}

export async function exportJournalVisual(input: JournalExportInput, settings: ExportSettings, onProgress?: ExportProgressHandler) {
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
    const archive = await zip.generateAsync({ type: "blob" });
    onProgress?.({ stage: "packing", current: 1, total: 1 });
    onProgress?.({ stage: "downloading", current: 0, total: 1 });
    downloadBlob(archive, `${input.slug}-${settings.format}.zip`);
    onProgress?.({ stage: "downloading", current: 1, total: 1 });
  } finally {
    prepared.stage.remove();
  }
}
