import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArticleExportMenu } from "../components/ArticleExportMenu";
import { getJournal, getPlace } from "../lib/content";

export function JournalPage() {
  const slug = decodeURIComponent(useParams().slug || "");
  const articleRef = useRef<HTMLElement>(null);
  const [headerActions, setHeaderActions] = useState<HTMLElement | null>(null);
  const journal = getJournal(slug);

  useEffect(() => {
    setHeaderActions(document.getElementById("site-header-actions"));
  }, []);

  if (!journal) return <Navigate to="/journals" replace />;

  const Content = journal.default;
  const place = getPlace(journal.frontmatter.placeId);
  const exportMenu = (
    <ArticleExportMenu
      slug={journal.frontmatter.slug}
      frontmatter={journal.frontmatter}
      placeName={place?.name}
      getArticle={() => articleRef.current}
    />
  );

  return (
    <>
      {headerActions
        ? createPortal(<div className="journal-actions">{exportMenu}</div>, headerActions)
        : null}
      <article ref={articleRef} data-journal-article="true" className="journal-article px-6 pb-20 pt-16 lg:px-10 lg:pt-16">
      <div className="journal-header">
        <p className="text-xs text-[#20211f]/50">
          创建于{" "}
          <time dateTime={journal.frontmatter.createdAt}>
            {journal.frontmatter.createdAt}
          </time>
          {place ? (
            <>
              {" "}
              ·{" "}
              <Link
                className="underline underline-offset-4"
                to={`/destinations/${place.slug}`}
              >
                {place.name}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <h1 className="mt-4 font-serif text-5xl leading-tight">
        {journal.frontmatter.title}
      </h1>
      <p className="mt-6 text-lg leading-8 text-[#20211f]/65">
        {journal.frontmatter.description}
      </p>
      <div className="prose-jewel mt-14">
        <Content />
      </div>
      </article>
    </>
  );
}
