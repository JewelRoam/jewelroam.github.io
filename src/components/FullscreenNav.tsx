import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { embeddedProjects } from "../lib/embedded-projects";

type NavSection = "destinations" | "projects";

const projectItems = Object.values(embeddedProjects);

function sectionForPath(pathname: string): NavSection | null {
  if (pathname.startsWith("/map") || pathname.startsWith("/journals") || pathname.startsWith("/photos")) {
    return "destinations";
  }
  if (projectItems.some((item) => pathname.startsWith(item.path))) return "projects";
  return null;
}

function isDestinationsPath(pathname: string) {
  return sectionForPath(pathname) === "destinations";
}

function isProjectsPath(pathname: string) {
  return sectionForPath(pathname) === "projects";
}

type FullscreenNavProps = {
  onClose: () => void;
  isClosing?: boolean;
};

export function FullscreenNav({ onClose, isClosing = false }: FullscreenNavProps) {
  const { pathname } = useLocation();
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeSection = sectionForPath(pathname);
  const [expandedSection, setExpandedSection] = useState<NavSection | null>(activeSection);
  const [userExpandedSection, setUserExpandedSection] = useState<NavSection | null>(null);

  useEffect(() => {
    firstItemRef.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [],
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const toggleSection = (section: NavSection) => {
    if (expandedSection === section) {
      setExpandedSection(null);
      setUserExpandedSection(null);
      return;
    }
    setExpandedSection(section);
    setUserExpandedSection(section);
  };

  return (
    <div
      ref={dialogRef}
      id="fullscreen-site-navigation"
      className={`fullscreen-nav${isClosing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="网站目录"
      onKeyDown={handleKeyDown}
    >
      <div className="fullscreen-nav__body">
        <nav className="fullscreen-nav__primary" aria-label="主要页面">
          <NavLink
            ref={firstItemRef}
            to="/jewelroam"
            onClick={onClose}
            className={({ isActive }) => [
              "fullscreen-nav__main-link",
              "fullscreen-nav__main-link--jewelroam",
              isActive ? "is-active" : "",
            ].filter(Boolean).join(" ")}
          >
            <span>JewelRoam</span>
          </NavLink>

          <button
            type="button"
            className={[
              "fullscreen-nav__main-link",
              "fullscreen-nav__main-button",
              "fullscreen-nav__main-link--destinations",
              isDestinationsPath(pathname) ? "is-active" : "",
              expandedSection === "destinations" && userExpandedSection === "destinations" ? "is-expanded" : "",
            ].filter(Boolean).join(" ")}
            aria-expanded={expandedSection === "destinations"}
            onClick={() => toggleSection("destinations")}
          >
            <span>Destinations</span>
          </button>

          <button
            type="button"
            className={[
              "fullscreen-nav__main-link",
              "fullscreen-nav__main-button",
              "fullscreen-nav__main-link--projects",
              isProjectsPath(pathname) ? "is-active" : "",
              expandedSection === "projects" && userExpandedSection === "projects" ? "is-expanded" : "",
            ].filter(Boolean).join(" ")}
            aria-expanded={expandedSection === "projects"}
            onClick={() => toggleSection("projects")}
          >
            <span>Projects</span>
          </button>
        </nav>

        <div
          className={`fullscreen-nav__secondary${expandedSection ? ` fullscreen-nav__secondary--${expandedSection}` : ""}`}
          aria-live="polite"
        >
          {expandedSection === "destinations" ? (
            <div className="fullscreen-nav__subsection">
              <div className="fullscreen-nav__subitems">
                <NavLink to="/map" onClick={onClose} className="fullscreen-nav__subitem">
                  <span>Map</span>
                </NavLink>
                <NavLink to="/journals" onClick={onClose} className="fullscreen-nav__subitem">
                  <span>Journals</span>
                </NavLink>
              </div>
            </div>
          ) : null}

          {expandedSection === "projects" ? (
            <div className="fullscreen-nav__subsection">
              <div className="fullscreen-nav__subitems">
                {projectItems.map((item) => (
                  <NavLink key={item.path} to={item.path} onClick={onClose} className="fullscreen-nav__subitem">
                    <span>{item.title}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
