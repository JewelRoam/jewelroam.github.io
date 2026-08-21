import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  ["/destinations", "Destinations"],
  ["/journals", "Journals"],
  ["/editor", "Capture"],
  ["/jewelroam", "JewelRoam"],
] as const;

export function GlassNav() {
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <nav
      ref={navRef}
      className={`glass-nav${isOpen ? " is-open" : ""}`}
      aria-label="Primary navigation"
    >
      <div
        id="primary-navigation"
        className="glass-nav__items"
        aria-hidden={!isOpen}
      >
        {navItems.map(([href, label]) => (
          <NavLink
            key={href}
            to={href}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `glass-nav__item${isActive ? " is-active" : ""}`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
      <button
        type="button"
        className="glass-nav__trigger"
        aria-controls="primary-navigation"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="glass-nav__icon" aria-hidden="true">
          <span />
          <span />
        </span>
      </button>
    </nav>
  );
}
