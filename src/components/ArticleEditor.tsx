import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { FileHandler } from "@tiptap/extension-file-handler";
import { del, get, set } from "idb-keyval";
import {
  Bold,
  Download,
  Heading2,
  ImagePlus,
  Italic,
  List,
  Quote,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import CreatableSelect from "react-select/creatable";
import { places } from "../lib/content";

const DRAFT_KEY = "jewelroam:article-draft";
const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

type Draft = {
  title: string;
  description: string;
  placeId: string;
  placeName: string;
  createdAt: string;
  updatedAt: string;
  html: string;
};

type StoredDraft = Omit<Draft, "createdAt" | "updatedAt" | "placeId" | "placeName"> & {
  createdAt?: string;
  updatedAt?: string;
  placeId?: string;
  placeName?: string;
  savedAt?: string;
};

type PlaceOption = { value: string; label: string; name: string; existing: boolean };

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

function normalizeDraft(draft: StoredDraft): Draft {
  const updatedAt = draft.updatedAt ?? draft.savedAt ?? new Date().toISOString();
  const existingPlace = places.find((place) => place.id === draft.placeId);
  return {
    title: draft.title,
    description: draft.description,
    placeId: draft.placeId ?? "",
    placeName: draft.placeName ?? existingPlace?.name ?? "",
    createdAt: draft.createdAt ?? updatedAt.slice(0, 10),
    updatedAt,
    html: draft.html,
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readDraft() {
  const draft = await get<StoredDraft>(DRAFT_KEY);
  if (draft) {
    const normalized = normalizeDraft(draft);
    if (!draft.createdAt || !draft.updatedAt || !draft.placeName) await set(DRAFT_KEY, normalized);
    return normalized;
  }

  const legacy = window.localStorage.getItem(DRAFT_KEY);
  if (!legacy) return null;

  try {
    const migrated = normalizeDraft(JSON.parse(legacy) as StoredDraft);
    await set(DRAFT_KEY, migrated);
    window.localStorage.removeItem(DRAFT_KEY);
    return migrated;
  } catch {
    return null;
  }
}

export function ArticleEditor() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [createdAt, setCreatedAt] = useState(today);
  const [updatedAt, setUpdatedAt] = useState("");
  const [status, setStatus] = useState("正在读取本地草稿…");
  const [hydrated, setHydrated] = useState(false);
  const [revision, setRevision] = useState(0);
  const savedRevision = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const markChanged = useCallback(() => setRevision((value) => value + 1), []);

  const insertImages = useCallback(async (currentEditor: Editor, files: File[], position?: number) => {
    const validFiles = files.filter((file) => IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE);
    const rejectedCount = files.length - validFiles.length;

    if (!validFiles.length) {
      setStatus("没有可导入的图片；支持 JPEG、PNG、WebP、GIF、AVIF，单张不超过 100 MB");
      return;
    }

    setStatus(`正在导入 ${validFiles.length} 张图片…`);
    try {
      const sources = await Promise.all(validFiles.map(fileToDataUrl));
      const imageNodes = sources.map((src, index) => ({
        type: "image",
        attrs: { src, alt: validFiles[index].name, title: validFiles[index].name },
      }));
      const content = imageNodes.flatMap((node, index) => (index ? [{ type: "paragraph" }, node] : [node]));
      const chain = currentEditor.chain().focus();

      if (position === undefined) chain.insertContent(content).run();
      else chain.insertContentAt(position, content).run();

      setStatus(`${validFiles.length} 张图片已加入草稿${rejectedCount ? `，跳过 ${rejectedCount} 个不支持的文件` : ""}`);
    } catch {
      setStatus("图片读取失败，请移除异常文件后重试");
    }
  }, []);

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

  useEffect(() => {
    if (!editor) return;
    let active = true;

    void readDraft().then((draft) => {
      if (!active) return;
      if (draft) {
        setTitle(draft.title);
        setDescription(draft.description);
        setPlaceId(draft.placeId);
        setPlaceName(draft.placeName);
        setCreatedAt(draft.createdAt);
        setUpdatedAt(draft.updatedAt);
        editor.commands.setContent(draft.html, { emitUpdate: false });
        setStatus("本地草稿已恢复");
      } else {
        setStatus("草稿将自动保存在当前浏览器");
      }
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !hydrated || revision === savedRevision.current) return;
    setStatus("保存中…");

    const timer = window.setTimeout(() => {
      const nextUpdatedAt = new Date().toISOString();
      const savingRevision = revision;
      const draft: Draft = { title, description, placeId, placeName, createdAt, updatedAt: nextUpdatedAt, html: editor.getHTML() };

      void set(DRAFT_KEY, draft)
        .then(() => {
          savedRevision.current = savingRevision;
          setUpdatedAt(nextUpdatedAt);
          setStatus("已自动保存");
        })
        .catch(() => setStatus("自动保存失败，请先导出草稿"));
    }, 600);

    return () => window.clearTimeout(timer);
  }, [createdAt, description, editor, hydrated, placeId, placeName, revision, title]);

  const exportDraft = () => {
    if (!editor) return;
    const normalizedPlaceName = placeName.trim();
    if (!normalizedPlaceName) {
      setStatus("请先选择或输入一个地点");
      return;
    }
    const exportedAt = new Date().toISOString();
    const payload = JSON.stringify({ title, description, placeId, placeName: normalizedPlaceName, placeStatus: placeId ? "existing" : "needs-place-record", createdAt, updatedAt: exportedAt, html: editor.getHTML(), exportedAt }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.trim().replace(/[^\w\u4e00-\u9fff-]+/g, "-") || "jewelroam-draft"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("草稿已导出，可以交给 agent 做发布准备");
  };

  const clearDraft = () => {
    if (!window.confirm("确定清空当前浏览器中的文章草稿吗？")) return;
    void del(DRAFT_KEY);
    window.localStorage.removeItem(DRAFT_KEY);
    editor?.commands.clearContent(false);
    savedRevision.current = revision;
    setTitle("");
    setPlaceId("");
    setPlaceName("");
    setDescription("");
    setCreatedAt(today());
    setUpdatedAt("");
    setStatus("草稿已清空");
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
      <header className="editor-header">
        <h1 className="font-serif text-5xl">Capture</h1>
        <p className="editor-intro">我曾偶尔使用 Apple 的 Notes 或 Journal app 记录想法，但它们始终没有提供一个足够顺手的图文编辑工作流，于是自己做了这个编辑器。图片会直接嵌入文章，保存为 Base64 编码，并随文章一起导出为 JSON，方便后续交给 Agent 继续整理与上线。支持同时拖入、粘贴或选择多张图片。图片保存在浏览器 IndexedDB 中，确认文章后再导出并交给 Agent 上传 R2。</p>
      </header>

      <div className="editor-meta">
        <div className="editor-title-fields">
          <input className="editor-title-input" value={title} onChange={(event) => { setTitle(event.target.value); markChanged(); }} placeholder="文章标题" aria-label="文章标题" />
          <input className="editor-description-input" value={description} onChange={(event) => { setDescription(event.target.value); markChanged(); }} placeholder="一句话摘要（可选）" aria-label="文章摘要" />
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
              value={placeName ? (PLACE_OPTIONS.find((option) => option.value === placeId) ?? { value: placeName, label: placeName, name: placeName, existing: false }) : null}
              onChange={(option) => {
                setPlaceId(option?.existing ? option.value : "");
                setPlaceName(option?.name ?? "");
                markChanged();
              }}
              onCreateOption={(input) => {
                setPlaceId("");
                setPlaceName(input.trim());
                markChanged();
              }}
              formatCreateLabel={(input) => `新建地点“${input}”`}
              noOptionsMessage={() => "输入新地点并按回车"}
              placeholder="搜索或输入新地点"
              isClearable
              unstyled
            />
            {!placeId && placeName && <p className="editor-place-note">新地点将在发布前由 Agent 补全坐标和地图区域。</p>}
          </div>
          <label className="editor-field editor-date-field">
            <span>创建日期</span>
            <input type="date" value={createdAt} onChange={(event) => { setCreatedAt(event.target.value); markChanged(); }} aria-label="创建日期" />
          </label>
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
      <footer className="editor-footer">
        <div className="editor-save-state">
          <p className="editor-hint" role="status">{status}</p>
          <p className="editor-updated-at">最近修改 <time dateTime={updatedAt}>{updatedAt ? new Date(updatedAt).toLocaleString() : "尚未保存"}</time></p>
        </div>
        <div className="editor-actions">
          <button type="button" onClick={clearDraft} className="editor-button editor-button-muted"><Trash2 size={16} /><span>清空草稿</span></button>
          <button type="button" onClick={exportDraft} className="editor-button editor-button-dark"><Download size={16} /><span>导出 JSON</span></button>
        </div>
      </footer>
    </section>
  );
}
