import type { ReactNode } from "react";

type PageProps = {
  title: string;
  intro: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Page({ title, intro, children, className }: PageProps) {
  return (
    <section className={`page-shell${className ? ` ${className}` : ""}`}>
      <header className="page-header">
        <h1 className="page-title font-serif">{title}</h1>
        <div className="page-intro">{intro}</div>
      </header>
      <div className="page-content">{children}</div>
    </section>
  );
}
