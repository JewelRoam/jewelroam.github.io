import { useEffect, useState, type ReactNode } from "react";
import { BackButton } from "./BackButton";
import { GlassNav } from "./GlassNav";

export function Layout({ children }: { children: ReactNode }) {
  const [showNavigationHint, setShowNavigationHint] = useState(true);

  useEffect(() => {
    const updateHint = () => setShowNavigationHint(window.scrollY <= 8);
    updateHint();
    window.addEventListener("scroll", updateHint, { passive: true });
    return () => window.removeEventListener("scroll", updateHint);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#20211f]">
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
      <main>
        {children}
      </main>
    </div>
  );
}
