import type { ReactNode } from "react";

type PageProps = {
  title: string;
  intro: ReactNode;
  children: ReactNode;
};

export function Page({ title, intro, children }: PageProps) {
  return (
    <section className="page-shell">
      <h1 className="font-serif text-5xl">{title}</h1>
      <div className="mt-5 leading-7 text-[#20211f]/65">{intro}</div>
      <div className="mt-14">{children}</div>
    </section>
  );
}
