import { useEffect, useRef } from "react";

export function ExportProgressDialog({ open, label }: { open: boolean; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="export-progress-dialog"
      aria-labelledby="export-progress-title"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="export-progress-dialog__content">
        <span className="journal-export-progress__spinner" aria-hidden="true" />
        <div>
          <p className="export-settings-dialog__eyebrow">EXPORTING</p>
          <h2 id="export-progress-title">正在导出</h2>
          <p className="export-progress-dialog__label" role="status" aria-live="polite">{label}</p>
        </div>
      </div>
    </dialog>
  );
}
