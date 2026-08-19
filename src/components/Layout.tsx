import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  ["/destinations", "Destinations"],
  ["/journals", "Journals"],
  ["/about", "关于"],
] as const;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f3ee] text-[#20211f]">
      <header className="border-b border-[#20211f]/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10">
          <NavLink to="/" className="font-serif text-xl tracking-[0.02em]">
            JewelRoam
          </NavLink>
          <nav className="flex items-center gap-6 text-sm text-[#20211f]/65">
            {import.meta.env.DEV && <NavLink to="/editor" className={({ isActive }) => (isActive ? "text-[#20211f]" : "transition hover:text-[#20211f]")}>编辑</NavLink>}
            {navItems.map(([href, label]) => (
              <NavLink
                key={href}
                to={href}
                className={({ isActive }) => (isActive ? "text-[#20211f]" : "transition hover:text-[#20211f]")}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main>
        {children}
      </main>
      <footer className="mx-auto mt-24 flex max-w-6xl justify-between border-t border-[#20211f]/10 px-6 py-8 text-xs text-[#20211f]/55 lg:px-10">
        <span>© 2026 JewelRoam</span>
        <NavLink to="/rights" className="hover:text-[#20211f]">使用与许可</NavLink>
      </footer>
    </div>
  );
}
