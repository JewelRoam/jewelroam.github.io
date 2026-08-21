import type { ReactNode } from "react";
import { GlassNav } from "./GlassNav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#20211f]">
      <header className="site-header">
        <div className="mx-auto flex max-w-6xl items-center justify-end px-6 py-4 lg:px-10">
          <GlassNav />
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}
