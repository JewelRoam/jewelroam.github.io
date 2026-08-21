import { lazy, Suspense } from "react";

const ArticleEditor = lazy(() =>
  import("../components/ArticleEditor").then((module) => ({
    default: module.ArticleEditor,
  })),
);

export function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-6 py-20 text-sm text-[#20211f]/55">
          正在打开编辑器…
        </div>
      }
    >
      <ArticleEditor />
    </Suspense>
  );
}
