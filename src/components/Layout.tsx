import { useLayoutEffect, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { BackButton } from "./BackButton";
import { GlassNav } from "./GlassNav";

function RouteScrollReset() {
  const { key } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [key, navigationType]);

  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="site-root min-h-screen">
      <RouteScrollReset />
      <header className="site-header">
        <div className="site-header__inner">
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
