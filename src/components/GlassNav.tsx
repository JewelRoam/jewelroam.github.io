import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { FullscreenNav } from "./FullscreenNav";

const NAV_EXIT_DURATION_MS = 520;

export function GlassNav() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const { pathname } = useLocation();
  const previousPathRef = useRef(pathname);

  const openMenu = useCallback(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    setClosing(false);
    setOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimerRef.current = null;
      triggerRef.current?.focus({ preventScroll: true });
    }, NAV_EXIT_DURATION_MS);
  }, [closing, open]);

  const menuVisible = open || closing;

  useEffect(() => {
    if (!menuVisible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuVisible]);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    if (open) closeMenu();
  }, [closeMenu, open, pathname]);

  useEffect(() => {
    if (!menuVisible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeMenu, menuVisible]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  return (
    <nav className={`fullscreen-nav-shell${menuVisible ? " is-open" : ""}`} aria-label="页面导航">
      {menuVisible ? <FullscreenNav onClose={closeMenu} isClosing={closing} /> : null}
      <button
        type="button"
        ref={triggerRef}
        className={`glass-circle-button fullscreen-nav__trigger${menuVisible ? " is-open" : ""}`}
        aria-label={menuVisible ? "关闭页面导航" : "打开页面导航"}
        aria-expanded={open}
        aria-controls="fullscreen-site-navigation"
        onClick={menuVisible ? closeMenu : openMenu}
      >
        {menuVisible
          ? <X size={18} strokeWidth={1.7} aria-hidden="true" />
          : <Menu size={18} strokeWidth={1.7} aria-hidden="true" />}
      </button>
    </nav>
  );
}
