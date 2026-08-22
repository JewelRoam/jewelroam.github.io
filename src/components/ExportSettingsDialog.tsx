import { useEffect, useRef, useState } from "react";
import type { ExportFormat, ExportRatio, ExportSettings } from "../lib/article-export";

type ExportSettingsDialogProps = {
  maxPageCount: number;
  mode: ExportSettings["mode"] | null;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
};

const ratios: { value: ExportRatio; label: string }[] = [
  { value: "1:1", label: "1:1" },
  { value: "2:3", label: "2:3" },
  { value: "3:4", label: "3:4" },
  { value: "9:16", label: "9:16" },
];

const formats: { value: ExportFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "pdf", label: "PDF" },
];

function initialSettings(mode: ExportSettings["mode"], maxPageCount: number): ExportSettings {
  return mode === "ratio"
    ? { mode, ratio: "9:16", format: "png" }
    : { mode, pageCount: Math.min(9, maxPageCount), format: "png" };
}

export function ExportSettingsDialog({ maxPageCount, mode, onClose, onExport }: ExportSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ExportSettings>(() => initialSettings("ratio", 1));
  const open = mode !== null;
  const countLimit = Math.max(1, Math.min(18, Math.round(maxPageCount)));

  useEffect(() => {
    if (mode) setDraft(initialSettings(mode, countLimit));
  }, [countLimit, mode]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="export-settings-dialog"
      aria-labelledby="export-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onExport(draft);
        }}
      >
        <div className="export-settings-dialog__header">
          <div>
            <p className="export-settings-dialog__eyebrow">EXPORT</p>
            <h2 id="export-settings-title">{draft.mode === "ratio" ? "比例切分" : "张数切分"}</h2>
          </div>
          <button type="button" className="export-settings-dialog__close" onClick={onClose} aria-label="关闭设置">×</button>
        </div>

        <fieldset className="export-settings-dialog__section">
          <legend>文件格式</legend>
          <div className="export-settings-dialog__segmented">
            {formats.map((format) => (
              <label key={format.value} className={draft.format === format.value ? "is-active" : ""}>
                <input
                  type="radio"
                  name="export-format"
                  checked={draft.format === format.value}
                  onChange={() => setDraft({ ...draft, format: format.value } as ExportSettings)}
                />
                {format.label}
              </label>
            ))}
          </div>
        </fieldset>

        {draft.mode === "ratio" ? (
          <fieldset className="export-settings-dialog__section">
            <legend>页面比例</legend>
            <div className="export-settings-dialog__segmented export-settings-dialog__segmented--ratio">
              {ratios.map((ratio) => (
                <label key={ratio.value} className={draft.ratio === ratio.value ? "is-active" : ""}>
                  <input
                    type="radio"
                    name="export-ratio"
                    checked={draft.ratio === ratio.value}
                    onChange={() => setDraft({ ...draft, ratio: ratio.value } as ExportSettings)}
                  />
                  {ratio.label}
                </label>
              ))}
            </div>
            <p className="export-settings-dialog__hint">文章会自动分页，图片保持原比例，不会裁切。</p>
          </fieldset>
        ) : (
          <fieldset className="export-settings-dialog__section">
            <legend>输出张数</legend>
            <div className="export-settings-dialog__range-row">
              <input
                type="range"
                name="export-page-count"
                min="1"
                max={countLimit}
                step="1"
                value={draft.mode === "count" ? draft.pageCount : 1}
                onChange={(event) => setDraft({ ...draft, pageCount: Number(event.target.value) } as ExportSettings)}
                aria-label="导出张数"
              />
              <output>{draft.mode === "count" ? draft.pageCount : 1} 张</output>
            </div>
            <p className="export-settings-dialog__hint">可选 1–{countLimit} 张，文章会按内容高度均衡分配。</p>
          </fieldset>
        )}

        <div className="export-settings-dialog__actions">
          <button type="button" className="export-settings-dialog__button export-settings-dialog__button--muted" onClick={onClose}>取消</button>
          <button type="submit" className="export-settings-dialog__button export-settings-dialog__button--dark">导出</button>
        </div>
      </form>
    </dialog>
  );
}
