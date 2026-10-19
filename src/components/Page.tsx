import type { ReactNode } from "react";

type PageProps = {
  title: string;
  intro: ReactNode;
  children: ReactNode;
  className?: string;
};

type PageHeaderProps = {
  title: ReactNode;
  intro: ReactNode;
  titleId?: string;
};

export function PageHeader({ title, intro, titleId }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1 id={titleId} className="page-title font-serif">{title}</h1>
      <div className="page-intro">{intro}</div>
    </header>
  );
}

export function Page({ title, intro, children, className }: PageProps) {
  return (
    <section className={`page-shell${className ? ` ${className}` : ""}`}>
      <PageHeader title={title} intro={intro} />
      <div className="page-content">{children}</div>
    </section>
  );
}
