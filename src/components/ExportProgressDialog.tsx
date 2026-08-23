import type { ExportProgress } from "../lib/article-export";

export function exportProgressLabel(progress: ExportProgress | null) {
  if (!progress) return "准备中…";
  if (progress.stage === "validating") return "检查文章内容";
  if (progress.stage === "building-layout") return "计算排版";
  if (progress.stage === "loading-images") return `读取图片 ${progress.current} / ${progress.total}`;
  if (progress.stage === "decoding-images") return `解码图片 ${progress.current} / ${progress.total}`;
  if (progress.stage === "rendering") return `生成页面 ${progress.current} / ${progress.total}`;
  if (progress.stage === "serializing") return "整理 JSON";
  if (progress.stage === "packing") return "打包文件";
  if (progress.stage === "downloading") return `准备下载 ${progress.current} / ${progress.total}`;
  return "导出处理中";
}

export function ExportProgressPanel({ label, error, onClose }: { label: string; error?: string; onClose: () => void }) {
  return (
    <div className="export-dialog__progress-content">
      {!error && <span className="export-dialog__spinner" aria-hidden="true" />}
      <div>
        <p className="export-dialog__eyebrow">{error ? "EXPORT ERROR" : "EXPORTING"}</p>
        <h2 id="export-progress-title">{error ? "导出失败" : "正在导出"}</h2>
        <p className="export-dialog__progress-label" role={error ? "alert" : "status"} aria-live="polite">{error || label}</p>
        {error && (
          <button type="button" className="export-dialog__progress-button" onClick={onClose}>关闭</button>
        )}
      </div>
    </div>
  );
}
