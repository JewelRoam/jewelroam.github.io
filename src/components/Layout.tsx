import { useEffect, useRef, useState, type ReactNode } from "react";
import { BackButton } from "./BackButton";
import { GlassNav } from "./GlassNav";

export function Layout({ children }: { children: ReactNode }) {
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const [showNavigationHint, setShowNavigationHint] = useState(true);

  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setShowNavigationHint(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="site-root min-h-screen">
      <header className="site-header">
        <div className="site-header__inner">
          <div className={`site-header__hint${showNavigationHint ? " is-visible" : ""}`} aria-hidden="true">
            <span>切换页面</span>
            <span className="site-header__hint-arrow">↗</span>
          </div>
          <GlassNav />
          <div id="site-header-actions" className="site-header__actions" />
          <BackButton />
        </div>
      </header>
      <div ref={scrollSentinelRef} className="site-scroll-sentinel" aria-hidden="true" />
      <main>
        {children}
      </main>
    </div>
  );
}
