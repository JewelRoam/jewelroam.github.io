import { useState } from "react";
import { FileImage, FileJson, Rows3, Send } from "lucide-react";
import type { JournalFrontmatter } from "../lib/content";
import {
  exportJournalJson,
  exportJournalVisual,
  getExportPageCountLimit,
  type ExportProgress,
  type ExportSettings,
} from "../lib/article-export";
import { ActionMenu } from "./ActionMenu";
import { ExportProgressDialog } from "./ExportProgressDialog";
import { ExportSettingsDialog } from "./ExportSettingsDialog";

export function ArticleExportMenu({
  slug,
  frontmatter,
  placeNames,
  getArticle,
}: {
  slug: string;
  frontmatter: JournalFrontmatter;
  placeNames?: string[];
  getArticle: () => HTMLElement | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settingsMode, setSettingsMode] = useState<ExportSettings["mode"] | null>(null);
  const [maxPageCount, setMaxPageCount] = useState(1);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const run = async (action: (article: HTMLElement, onProgress: (progress: ExportProgress) => void) => Promise<void> | void) => {
    const article = getArticle();
    if (!article) {
      setError("找不到文章内容");
      return;
    }
    setBusy(true);
    setError("");
    setProgress(null);
    try {
      await action(article, setProgress);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导出失败，请稍后重试");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const progressLabel = progress?.stage === "loading-images"
    ? `读取图片 ${progress.current ?? 0} / ${progress.total ?? 0}`
    : progress?.stage === "building-layout"
      ? "计算排版"
      : progress?.stage === "rendering"
        ? `生成页面 ${progress.current ?? 0} / ${progress.total ?? 0}`
        : progress?.stage === "packing"
          ? "打包文件"
          : "准备中…";

  return (
    <div className="journal-export-menu">
      <ActionMenu
        label="导出"
        icon={<Send size={17} strokeWidth={1.8} />}
        items={[
          {
            label: "比例切分",
            icon: <FileImage size={15} />,
            disabled: busy,
            onSelect: () => setSettingsMode("ratio"),
          },
          {
            label: "张数切分",
            icon: <Rows3 size={15} />,
            disabled: busy,
            onSelect: () => {
              const article = getArticle();
              if (!article) {
                setError("找不到文章内容");
                return;
              }
              setMaxPageCount(getExportPageCountLimit(article));
              setSettingsMode("count");
            },
          },
          {
            label: "导出 JSON",
            icon: <FileJson size={15} />,
            disabled: busy,
            onSelect: () => run((article) => exportJournalJson({ slug, frontmatter, placeNames, article })),
          },
        ]}
      />
      {error && <p className="journal-export-menu__error" role="status">{error}</p>}
      <ExportProgressDialog open={busy} label={progressLabel} />
      <ExportSettingsDialog
        maxPageCount={maxPageCount}
        mode={settingsMode}
        onClose={() => setSettingsMode(null)}
        onExport={(nextSettings) => {
          setSettingsMode(null);
          void run((article, onProgress) => exportJournalVisual({ slug, frontmatter, placeNames, article }, nextSettings, onProgress));
        }}
      />
    </div>
  );
}
