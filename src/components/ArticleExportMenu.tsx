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
import { useExportTask } from "../hooks/useExportTask";
import { ActionMenu } from "./ActionMenu";
import { ExportDialog } from "./ExportDialog";
import { exportProgressLabel, ExportProgressPanel } from "./ExportProgressDialog";
import { ExportSettingsPanel } from "./ExportSettingsDialog";

export function ArticleExportMenu({
  slug,
  frontmatter,
  placeName,
  getArticle,
}: {
  slug: string;
  frontmatter: JournalFrontmatter;
  placeName?: string;
  getArticle: () => HTMLElement | null;
}) {
  const [settingsMode, setSettingsMode] = useState<ExportSettings["mode"] | null>(null);
  const [maxPageCount, setMaxPageCount] = useState(1);
  const { busy, clearError, error, progress, run: runExport } = useExportTask();

  const run = (action: (article: HTMLElement, onProgress: (progress: ExportProgress) => void) => Promise<void> | void) => {
    void runExport(async (onProgress) => {
      const article = getArticle();
      if (!article) throw new Error("找不到文章内容");
      await action(article, onProgress);
    });
  };

  const progressLabel = exportProgressLabel(progress);

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
                run(() => {
                  throw new Error("找不到文章内容");
                });
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
            onSelect: () => run((article, onProgress) => exportJournalJson({ slug, frontmatter, placeName, article }, onProgress)),
          },
        ]}
      />
      <ExportDialog
        open={busy || Boolean(error) || settingsMode !== null}
        variant={busy || error ? "progress" : "settings"}
        titleId={busy || error ? "export-progress-title" : "export-settings-title"}
        onCancel={() => {
          if (busy) return;
          if (error) clearError();
          else setSettingsMode(null);
        }}
      >
        {busy || error ? (
          <ExportProgressPanel label={progressLabel} error={error || undefined} onClose={clearError} />
        ) : (
          <ExportSettingsPanel
            maxPageCount={maxPageCount}
            mode={settingsMode}
            onClose={() => setSettingsMode(null)}
            onExport={(nextSettings) => {
              setSettingsMode(null);
              void run((article, onProgress) => exportJournalVisual({ slug, frontmatter, placeName, article }, nextSettings, onProgress));
            }}
          />
        )}
      </ExportDialog>
    </div>
  );
}
