import { useEffect, useRef, useState, type ReactNode } from "react";

type GlassMenuProps = {
  label: string;
  icon: ReactNode;
  variant?: "primary" | "action";
  menuId?: string;
  menuRole?: "menu";
  closeLabel?: string;
  children: (open: boolean, close: () => void) => ReactNode;
};

/** Shared glass menu shell used by primary navigation and contextual actions. */
export function GlassMenu({
  label,
  icon,
  variant = "action",
  menuId,
  menuRole,
  closeLabel,
  children,
}: GlassMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className={`glass-menu glass-menu--${variant}${open ? " is-open" : ""}`}>
      <div
        id={menuId}
        className="glass-menu__items"
        role={menuRole}
        aria-hidden={!open}
      >
        {children(open, () => setOpen(false))}
      </div>
      <button
        type="button"
        className="glass-circle-button glass-menu__trigger"
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={open ? closeLabel ?? label : label}
        title={open ? closeLabel ?? label : label}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
      </button>
    </div>
  );
}
