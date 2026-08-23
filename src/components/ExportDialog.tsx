import { useEffect, useRef, type ReactNode } from "react";

type ExportDialogProps = {
  open: boolean;
  variant: "settings" | "progress";
  titleId: string;
  onCancel: () => void;
  children: ReactNode;
};

export function ExportDialog({ open, variant, titleId, onCancel, children }: ExportDialogProps) {
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
      className={`export-dialog export-dialog--${variant}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {children}
    </dialog>
  );
}
