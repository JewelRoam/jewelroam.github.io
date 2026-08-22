import type { ReactNode } from "react";
import { BackButton } from "./BackButton";
import { GlassNav } from "./GlassNav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#20211f]">
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
