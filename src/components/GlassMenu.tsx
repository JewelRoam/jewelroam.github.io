import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

type GlassMenuProps = {
  label: string;
  icon: ReactNode | ((open: boolean) => ReactNode);
  variant?: "primary" | "action";
  defaultOpen?: boolean;
  menuId?: string;
  menuRole?: "menu";
  closeLabel?: string;
  tooltip?: string;
  autoFocusOnOpen?: boolean;
  children: (open: boolean, close: () => void) => ReactNode;
};

const AUTO_OPEN_DELAY_MS = 120;
const AUTO_OPEN_HOLD_MS = 2600;

/** Shared glass menu shell used by primary navigation and contextual actions. */
export function GlassMenu({
  label,
  icon,
  variant = "action",
  defaultOpen = false,
  menuId,
  menuRole,
  closeLabel,
  tooltip,
  autoFocusOnOpen = true,
  children,
}: GlassMenuProps) {
  const [open, setOpen] = useState(false);
  const generatedMenuId = useId();
  const resolvedMenuId = menuId ?? `glass-menu-${generatedMenuId.replace(/:/g, "")}`;
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<"first" | "last" | null>(null);
  const autoSequenceRef = useRef(0);
  const triggerLabel = open ? closeLabel ?? label : label;

  const close = useCallback(() => setOpen(false), []);
  const cancelAutoSequence = useCallback(() => {
    autoSequenceRef.current += 1;
  }, []);
  const closeAndRestoreFocus = useCallback(() => {
    close();
    const restoreFocus = () => {
      if (menuRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(restoreFocus);
    else restoreFocus();
  }, [close]);

  const getEnabledItems = useCallback(() => {
    const selector = menuRole === "menu" ? '[role="menuitem"]' : ".glass-menu__item";

    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>(selector) ?? [])
      .filter((item) => !item.matches(":disabled") && item.getAttribute("aria-disabled") !== "true");
  }, [menuRole]);

  const focusItem = useCallback((item: HTMLElement, items: HTMLElement[]) => {
    if (menuRole === "menu") {
      items.forEach((candidate) => {
        candidate.tabIndex = candidate === item ? 0 : -1;
      });
    }

    item.focus({ preventScroll: true });
  }, [menuRole]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (menuRole === "menu" && event.key === "Tab") {
      close();
      return;
    }

    const direction = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    }[event.key];
    if (direction === undefined && event.key !== "Home" && event.key !== "End") return;
    const step = direction ?? 0;

    const items = getEnabledItems();
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : currentIndex === -1
          ? step === 1 ? 0 : items.length - 1
          : (currentIndex + step + items.length) % items.length;

    event.preventDefault();
    focusItem(items[nextIndex], items);
  };

  useEffect(() => {
    if (!defaultOpen) return;
    const sequence = autoSequenceRef.current + 1;
    let openTimer = 0;
    let closeTimer = 0;
    autoSequenceRef.current = sequence;
    const frame = window.requestAnimationFrame(() => {
      openTimer = window.setTimeout(() => {
        if (autoSequenceRef.current !== sequence) return;
        setOpen(true);
        closeTimer = window.setTimeout(() => {
          if (autoSequenceRef.current !== sequence) return;
          setOpen(false);
        }, AUTO_OPEN_HOLD_MS);
      }, AUTO_OPEN_DELAY_MS);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
  }, [defaultOpen]);

  useEffect(() => {
    if (!open || (!autoFocusOnOpen && pendingFocusRef.current === null)) {
      pendingFocusRef.current = null;
      return;
    }

    const items = getEnabledItems();
    const pendingFocus = pendingFocusRef.current;
    const currentItem = items.find((item) => item.getAttribute("aria-current") === "page");
    const initialItem = pendingFocus === "last"
      ? items[items.length - 1]
      : pendingFocus === "first"
        ? items[0]
        : currentItem ?? items[0];
    if (initialItem) focusItem(initialItem, items);
  }, [autoFocusOnOpen, focusItem, getEnabledItems, open]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;

      if (menuRef.current?.contains(document.activeElement)) closeAndRestoreFocus();
      else close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const eventInsideMenu = menuRef.current?.contains(event.target as Node);
      const focusInsideMenu = menuRef.current?.contains(activeElement);
      if (event.key !== "Escape" || (!eventInsideMenu && !focusInsideMenu)) return;
      event.preventDefault();
      closeAndRestoreFocus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [close, closeAndRestoreFocus, open]);

  return (
    <div
      ref={menuRef}
      className={`glass-menu glass-menu--${variant}${open ? " is-open" : ""}`}
      onPointerEnter={cancelAutoSequence}
      onFocusCapture={cancelAutoSequence}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <div
        id={resolvedMenuId}
        className="glass-menu__items"
        role={menuRole}
        aria-labelledby={menuRole === "menu" ? `${resolvedMenuId}-trigger` : undefined}
        aria-hidden={!open}
        onKeyDown={handleMenuKeyDown}
      >
        {children(open, close)}
      </div>
      <button
        type="button"
        ref={triggerRef}
        id={`${resolvedMenuId}-trigger`}
        className="glass-circle-button glass-menu__trigger"
        aria-controls={resolvedMenuId}
        aria-expanded={open}
        aria-haspopup={menuRole}
        aria-label={triggerLabel}
        title={tooltip ? undefined : triggerLabel}
        onKeyDown={(event) => {
          cancelAutoSequence();
          const focusTarget = {
            ArrowDown: "first",
            ArrowUp: "last",
            Home: "first",
            End: "last",
          }[event.key] as "first" | "last" | undefined;
          if (!focusTarget) return;

          event.preventDefault();
          pendingFocusRef.current = focusTarget;
          if (open) {
            const items = getEnabledItems();
            const target = focusTarget === "last" ? items[items.length - 1] : items[0];
            if (target) focusItem(target, items);
          } else {
            setOpen(true);
          }
        }}
        onClick={() => {
          cancelAutoSequence();
          if (open) close();
          else setOpen(true);
        }}
      >
        {typeof icon === "function" ? icon(open) : icon}
      </button>
      {tooltip ? <span className="glass-menu__tooltip" aria-hidden="true">{tooltip}</span> : null}
    </div>
  );
}
