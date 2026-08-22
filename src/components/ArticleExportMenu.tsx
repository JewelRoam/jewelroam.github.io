import { useState } from "react";
import { FileImage, FileJson, FileText, Send } from "lucide-react";
import type { JournalFrontmatter } from "../lib/content";
import { exportJournalJson, exportJournalPdf, exportJournalPng } from "../lib/article-export";
import { ActionMenu } from "./ActionMenu";

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

  const run = async (action: () => Promise<void> | void) => {
    const article = getArticle();
    if (!article) {
      setError("找不到文章内容");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导出失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="journal-export-menu">
      <ActionMenu
        label={busy ? "准备中…" : "导出"}
        icon={<Send size={17} strokeWidth={1.8} />}
        items={[
          {
            label: "切分为 PNG",
            icon: <FileImage size={15} />,
            disabled: busy,
            onSelect: () => run(() => exportJournalPng({ slug, frontmatter, placeNames, article: getArticle()! })),
          },
          {
            label: "导出 PDF",
            icon: <FileText size={15} />,
            disabled: busy,
            onSelect: () => run(() => exportJournalPdf(getArticle()!)),
          },
          {
            label: "导出 JSON",
            icon: <FileJson size={15} />,
            disabled: busy,
            onSelect: () => run(() => exportJournalJson({ slug, frontmatter, placeNames, article: getArticle()! })),
          },
        ]}
      />
      {error && <p className="journal-export-menu__error" role="status">{error}</p>}
    </div>
  );
}
