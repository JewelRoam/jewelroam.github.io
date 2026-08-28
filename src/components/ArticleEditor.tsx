import { useCallback, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { FileHandler } from "@tiptap/extension-file-handler";
import {
  Bold,
  Download,
  Heading2,
  ImagePlus,
  Italic,
  LayoutGrid,
  List,
  Quote,
  Redo2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import CreatableSelect from "react-select/creatable";
import {
  appendImagesToHtml,
  extractImagesFromHtml,
} from "../lib/article-document";
import {
  articleDraftSchema,
  type ArticleImage,
  type MediaLayout,
  type StoredDraft,
} from "../lib/content-schema";
import { downloadJson } from "../lib/article-export";
import { places } from "../lib/content";
import { issuesFromZod, summarizeValidationIssues } from "../lib/content-validation";
import { useArticleDraftPersistence } from "../hooks/useArticleDraftPersistence";
import { useExportTask } from "../hooks/useExportTask";
import { ExportDialog } from "./ExportDialog";
import { exportProgressLabel, ExportProgressPanel } from "./ExportProgressDialog";
import { ImageFrame } from "./ImageFrame";

const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const IMAGE_READ_CONCURRENCY = 2;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

type PlaceOption = { value: string; label: string; name: string; existing: boolean };
type SelectedPlace = { id: string; name: string };

const PLACE_OPTIONS: PlaceOption[] = places.map((place) => ({
  value: place.id,
  label: [place.name, place.region].filter(Boolean).join(" · "),
  name: place.name,
  existing: true,
}));

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function filesToDataUrls(files: File[]) {
  const sources: string[] = [];
  for (let index = 0; index < files.length; index += IMAGE_READ_CONCURRENCY) {
    const batch = files.slice(index, index + IMAGE_READ_CONCURRENCY);
    sources.push(...await Promise.all(batch.map(fileToDataUrl)));
  }
  return sources;
}

function createImageId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `image-${uuid || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export function ArticleEditor() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [createdAt, setCreatedAt] = useState(today);
  const [mediaLayout, setMediaLayout] = useState<MediaLayout>("inline");
  const [gallery, setGallery] = useState<ArticleImage[]>([]);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const { busy: exportBusy, clearError: clearExportError, error: exportError, progress: exportProgress, run: runExport } = useExportTask();

  const markChanged = useCallback(() => {
    setNotice("");
    setRevision((value) => value + 1);
  }, []);

  const insertImages = useCallback(async (currentEditor: Editor, files: File[], position?: number) => {
    const validFiles = files.filter((file) => IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE);
    const rejectedCount = files.length - validFiles.length;

    if (!validFiles.length) {
      setNotice("没有可导入的图片；支持 JPEG、PNG、WebP、GIF、AVIF，单张不超过 100 MB");
      return;
    }

    setNotice(`正在导入 ${validFiles.length} 张图片…`);
    try {
      const sources = await filesToDataUrls(validFiles);
      const importedImages = sources.map((src, index): ArticleImage => ({
        id: createImageId(),
        type: "image",
        src,
        sourceName: validFiles[index].name,
        alt: validFiles[index].name,
        title: validFiles[index].name,
        caption: "",
      }));

      if (mediaLayout === "gallery") {
        setGallery((items) => [...items, ...importedImages]);
        markChanged();
        setNotice(`${validFiles.length} 张图片已加入图集${rejectedCount ? `，跳过 ${rejectedCount} 个不支持的文件` : ""}`);
        return;
      }

      const imageNodes = sources.map((src, index) => ({
        type: "image",
        attrs: { src, alt: validFiles[index].name, title: validFiles[index].name },
      }));
      const content = imageNodes.flatMap((node, index) => (index ? [{ type: "paragraph" }, node] : [node]));
      const chain = currentEditor.chain().focus();

      if (position === undefined) chain.insertContent(content).run();
      else chain.insertContentAt(position, content).run();

      setNotice(`${validFiles.length} 张图片已加入草稿${rejectedCount ? `，跳过 ${rejectedCount} 个不支持的文件` : ""}`);
    } catch {
      setNotice("图片读取失败，请移除异常文件后重试");
    }
  }, [markChanged, mediaLayout]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true, HTMLAttributes: { class: "article-image editor-image" } }),
      Placeholder.configure({ placeholder: "从这里开始写。可将一张或多张图片直接拖进正文……" }),
      FileHandler.configure({
        allowedMimeTypes: IMAGE_TYPES,
        consumePasteEvent: true,
        onDrop: (currentEditor, files, position) => void insertImages(currentEditor, files, position),
        onPaste: (currentEditor, files) => void insertImages(currentEditor, files),
      }),
    ],
    content: "<p></p>",
    editorProps: { attributes: { class: "editor-content" } },
    onUpdate: markChanged,
  });

  const createDraft = useCallback((nextUpdatedAt: string): StoredDraft => ({
    schemaVersion: 4,
    kind: "journal",
    title,
    description,
    placeId: selectedPlace?.id ?? "",
    placeName: selectedPlace?.name ?? "",
    createdAt,
    updatedAt: nextUpdatedAt,
    mediaLayout,
    html: editor?.getHTML() || "<p></p>",
    gallery,
  }), [createdAt, description, editor, gallery, mediaLayout, selectedPlace, title]);

  const applyDraft = useCallback((draft: StoredDraft) => {
    setTitle(draft.title);
    setDescription(draft.description);
    setSelectedPlace(draft.placeName ? { id: draft.placeId, name: draft.placeName } : null);
    setCreatedAt(draft.createdAt);
    setMediaLayout(draft.mediaLayout);
    setGallery(draft.gallery);
    editor?.commands.setContent(draft.html, { emitUpdate: false });
    setNotice("本地草稿已恢复");
  }, [editor]);

  const {
    clearStoredDraft,
    hydrated,
    setUpdatedAt,
    state: persistenceState,
    updatedAt,
  } = useArticleDraftPersistence({ editor, revision, createDraft, applyDraft });

  const persistenceMessage = persistenceState === "loading"
    ? "正在读取本地草稿…"
    : persistenceState === "saving"
      ? "保存中…"
      : persistenceState === "saved"
        ? "已自动保存"
        : persistenceState === "error"
          ? "自动保存失败，请先导出草稿"
          : "草稿将自动保存在当前浏览器";
  const status = notice || persistenceMessage;

  const exportDraft = () => {
    void runExport(async (onProgress) => {
      if (!hydrated) throw new Error("本地草稿仍在读取，请稍后再导出");
      if (!editor) throw new Error("编辑器尚未准备好，请稍后再试");
      if (!title.trim()) throw new Error("请先填写文章标题");
      if (!selectedPlace?.name.trim()) throw new Error("请先选择或输入一个地点");

      const exportedAt = new Date().toISOString();
      const result = articleDraftSchema.safeParse({
        schemaVersion: 4,
        kind: "journal",
        title,
        description,
        placeId: selectedPlace?.id ?? "",
        placeName: selectedPlace?.name ?? "",
        createdAt,
        updatedAt: updatedAt || exportedAt,
        exportedAt,
        mediaLayout,
        html: editor.getHTML(),
        gallery,
      });
      if (!result.success) {
        throw new Error(`文章内容无法导出：${summarizeValidationIssues(issuesFromZod(result.error))}`);
      }

      onProgress({ stage: "serializing", current: 1, total: 1 });
      const filename = `${title.trim().replace(/[^\w\u4e00-\u9fff-]+/g, "-") || "jewelroam-draft"}.json`;
      onProgress({ stage: "downloading", current: 0, total: 1 });
      await downloadJson(result.data, filename);
      onProgress({ stage: "downloading", current: 1, total: 1 });
      setNotice("草稿已导出，可以交给 agent 做发布准备");
    });
  };

  const clearDraft = () => {
    if (!window.confirm("确定清空当前浏览器中的文章草稿吗？")) return;
    void clearStoredDraft();
    editor?.commands.clearContent(false);
    setTitle("");
    setSelectedPlace(null);
    setDescription("");
    setCreatedAt(today());
    setUpdatedAt("");
    setMediaLayout("inline");
    setGallery([]);
    setNotice("草稿已清空");
  };

  const toggleMediaLayout = (nextLayout: MediaLayout) => {
    if (!editor || nextLayout === mediaLayout) return;

    if (nextLayout === "gallery") {
      const extracted = extractImagesFromHtml(editor.getHTML());
      setGallery((items) => [...items, ...extracted.images]);
      editor.commands.setContent(extracted.html, { emitUpdate: false });
    } else {
      editor.commands.setContent(appendImagesToHtml(editor.getHTML(), gallery), { emitUpdate: false });
      setGallery([]);
    }

    setMediaLayout(nextLayout);
    markChanged();
  };

  const importDraft = async (file: File) => {
    try {
      let value: unknown;
      try {
        value = JSON.parse(await file.text());
      } catch {
        setNotice("导入失败：文件不是有效的 JSON");
        return;
      }
      const result = articleDraftSchema.safeParse(value);
      if (!result.success) {
        setNotice(`导入失败：${summarizeValidationIssues(issuesFromZod(result.error))}`);
        return;
      }
      const imported = result.data;
      if ((title.trim() || description.trim() || editor?.getText().trim() || gallery.length) && !window.confirm("导入会覆盖当前草稿，确定继续吗？")) return;
      setTitle(imported.title);
      setDescription(imported.description);
      setSelectedPlace(imported.placeName ? { id: imported.placeId, name: imported.placeName } : null);
      setCreatedAt(imported.createdAt || today());
      setUpdatedAt(imported.updatedAt);
      setMediaLayout(imported.mediaLayout);
      setGallery(imported.gallery);
      editor?.commands.setContent(imported.html, { emitUpdate: false });
      markChanged();
      setNotice("JSON 草稿已导入");
    } catch (error) {
      setNotice(error instanceof Error ? `导入失败：${error.message}` : "导入失败：JSON 格式无效");
    }
  };

  const openFilePicker = () => {
    const input = fileInput.current;
    if (!input || !hydrated) return;

    // showPicker keeps the action tied to the toolbar click in embedded browsers.
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch {
      input.click();
    }
  };

  return (
    <section className="page-shell editor-shell">
      <header className="editor-header page-header">
        <h1 className="page-title font-serif">Capture</h1>
        <p className="editor-intro page-intro">我曾偶尔使用 Apple 的 Notes 或 Journal app 记录想法，但它们始终没有提供一个足够顺手的图文编辑工作流，于是自己做了这个编辑器。图片支持同时拖入、粘贴或选择多张，暂存在浏览器 IndexedDB 中，并嵌入为 Base64 编码，随文章一起导出为 JSON，方便后续交给 Agent 继续整理与上线。</p>
      </header>

      <div className="editor-meta">
        <div className="editor-title-fields">
          <label className="editor-title-label" htmlFor="editor-title">文章标题</label>
          <input id="editor-title" className="editor-title-input" value={title} onChange={(event) => { setTitle(event.target.value); markChanged(); }} placeholder="开始输入标题" />
          <label className="editor-title-label" htmlFor="editor-description">文章摘要 <span>可选</span></label>
          <input id="editor-description" className="editor-description-input" value={description} onChange={(event) => { setDescription(event.target.value); markChanged(); }} placeholder="用一句话记录这次停留" />
        </div>
        <div className="editor-context-fields">
          <div className="editor-field editor-place-field">
            <label htmlFor="editor-place-select">地点</label>
            <CreatableSelect<PlaceOption, false>
              inputId="editor-place-select"
              aria-label="Journal 地点"
              className="editor-place-select"
              classNamePrefix="place-select"
              options={PLACE_OPTIONS}
              value={selectedPlace
                ? PLACE_OPTIONS.find((option) => option.value === selectedPlace.id) ?? {
                  value: selectedPlace.id || selectedPlace.name,
                  label: selectedPlace.name,
                  name: selectedPlace.name,
                  existing: Boolean(selectedPlace.id),
                }
                : null}
              onChange={(option) => {
                setSelectedPlace(option ? {
                  id: option.existing ? option.value : "",
                  name: option.name,
                } : null);
                markChanged();
              }}
              onCreateOption={(input) => {
                const name = input.trim();
                if (!name) return;
                setSelectedPlace({ id: "", name });
                markChanged();
              }}
              formatCreateLabel={(input) => `新建地点“${input}”`}
              noOptionsMessage={() => "输入新地点并按回车"}
              placeholder="搜索或输入地点"
              isClearable
              unstyled
            />
            {selectedPlace && !selectedPlace.id && <p className="editor-place-note">新地点将在发布前由 Agent 补全坐标和地图区域。</p>}
          </div>
          <label className="editor-field editor-date-field">
            <span>创建日期</span>
            <input type="date" value={createdAt} onChange={(event) => { setCreatedAt(event.target.value); markChanged(); }} aria-label="创建日期" />
          </label>
        </div>
      </div>

      <div className="editor-layout-switcher" role="group" aria-label="图片展示方式">
        <span className="editor-layout-switcher__label">图片</span>
        <div className="editor-layout-options">
          <button
            type="button"
            className={mediaLayout === "inline" ? "is-active" : ""}
            aria-pressed={mediaLayout === "inline"}
            onClick={() => toggleMediaLayout("inline")}
          >
            随文插入
          </button>
          <button
            type="button"
            className={mediaLayout === "gallery" ? "is-active" : ""}
            aria-pressed={mediaLayout === "gallery"}
            onClick={() => toggleMediaLayout("gallery")}
          >
            <LayoutGrid size={15} />
            图集展示
          </button>
        </div>
      </div>

      <div className="editor-toolbar" aria-label="编辑工具">
        <div className="editor-toolbar-group">
          <button type="button" className="editor-tool-button" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().chain().focus().undo().run()} aria-label="撤销" title="撤销"><Undo2 size={17} /></button>
          <button type="button" className="editor-tool-button" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().chain().focus().redo().run()} aria-label="重做" title="重做"><Redo2 size={17} /></button>
          <span className="editor-toolbar-separator" aria-hidden="true" />
          <button type="button" className={`editor-tool-button${editor?.isActive("bold") ? " is-active" : ""}`} onClick={() => editor?.chain().focus().toggleBold().run()} aria-label="粗体" title="粗体"><Bold size={17} /></button>
          <button type="button" className={`editor-tool-button${editor?.isActive("italic") ? " is-active" : ""}`} onClick={() => editor?.chain().focus().toggleItalic().run()} aria-label="斜体" title="斜体"><Italic size={17} /></button>
          <button type="button" className={`editor-tool-button${editor?.isActive("heading", { level: 2 }) ? " is-active" : ""}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="小标题" title="小标题"><Heading2 size={18} /></button>
          <button type="button" className={`editor-tool-button${editor?.isActive("blockquote") ? " is-active" : ""}`} onClick={() => editor?.chain().focus().toggleBlockquote().run()} aria-label="引用" title="引用"><Quote size={17} /></button>
          <button type="button" className={`editor-tool-button${editor?.isActive("bulletList") ? " is-active" : ""}`} onClick={() => editor?.chain().focus().toggleBulletList().run()} aria-label="列表" title="列表"><List size={17} /></button>
        </div>
        <span className="editor-toolbar-spacer" />
        <button type="button" className="editor-image-button" onClick={openFilePicker} disabled={!hydrated} aria-label="添加图片" title="添加一张或多张图片"><ImagePlus size={17} /><span>添加图片</span></button>
        <input
          ref={fileInput}
          id="editor-image-input"
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          className="editor-file-input"
          onChange={(event) => {
            if (editor && event.target.files) void insertImages(editor, Array.from(event.target.files));
            event.target.value = "";
          }}
        />
      </div>

      <div className="editor-paper">
        <EditorContent editor={editor} />
      </div>
      {mediaLayout === "gallery" && (
        <section className="editor-gallery" aria-label="文章图片">
          <div className="editor-gallery__header">
            <div>
              <h2>图片</h2>
              <p>{gallery.length ? `${gallery.length} 张图片将在正文之后展示` : "将图片拖到这里，文章会在正文之后集中展示"}</p>
            </div>
            <button type="button" className="editor-gallery__add" onClick={openFilePicker} disabled={!hydrated}>
              <ImagePlus size={16} />
              添加图片
            </button>
          </div>
          {gallery.length > 0 && (
            <div className="editor-gallery__grid">
              {gallery.map((image) => (
                <ImageFrame
                  key={image.id}
                  className="editor-gallery__item"
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setGallery((items) => items.filter((item) => item.id !== image.id));
                        markChanged();
                      }}
                      aria-label={`移除${image.sourceName}`}
                      title="移除图片"
                    >
                      <X size={15} />
                    </button>
                  }
                >
                  <img
                    className="media-frame__image media-frame__image--bounded"
                    src={image.src}
                    alt={image.alt || image.sourceName}
                  />
                </ImageFrame>
              ))}
            </div>
          )}
        </section>
      )}
      <footer className="editor-footer">
        <div className="editor-save-state">
          <p className="editor-hint" role="status">{status}</p>
          <p className="editor-updated-at">最近修改 <time dateTime={updatedAt}>{updatedAt ? new Date(updatedAt).toLocaleString() : "尚未保存"}</time></p>
        </div>
        <div className="editor-actions">
          <button type="button" onClick={() => importInput.current?.click()} className="editor-button editor-button-muted"><Upload size={16} /><span>导入 JSON</span></button>
          <button type="button" onClick={clearDraft} className="editor-button editor-button-muted"><Trash2 size={16} /><span>清空草稿</span></button>
          <button type="button" onClick={() => void exportDraft()} disabled={exportBusy || !hydrated} className="editor-button editor-button-dark"><Download size={16} /><span>导出 JSON</span></button>
        </div>
      </footer>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        className="editor-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importDraft(file);
          event.target.value = "";
        }}
      />
      <ExportDialog
        open={exportBusy || Boolean(exportError)}
        variant="progress"
        titleId="export-progress-title"
        onCancel={() => {
          if (!exportBusy) clearExportError();
        }}
      >
        <ExportProgressPanel
          label={exportProgressLabel(exportProgress)}
          error={exportError || undefined}
          onClose={clearExportError}
        />
      </ExportDialog>
    </section>
  );
}
