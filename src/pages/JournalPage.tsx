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
  const journalPlace = getPlace(journal.frontmatter.placeId);
  const exportMenu = (
    <ArticleExportMenu
      slug={journal.frontmatter.slug}
      frontmatter={journal.frontmatter}
      placeName={journalPlace?.name ?? journal.frontmatter.placeId}
      getArticle={() => articleRef.current}
    />
  );

  return (
    <>
      {headerActions
        ? createPortal(<div className="journal-actions">{exportMenu}</div>, headerActions)
        : null}
      <article ref={articleRef} data-journal-article="true" className="journal-article page-shell">
        <div className="journal-intro">
          <div className="journal-header">
            <p className="journal-meta">
              创建于{" "}
              <time dateTime={journal.frontmatter.createdAt}>
                {journal.frontmatter.createdAt}
              </time>
              {journalPlace ? (
                <span>
                  {" "}·{" "}
                  <Link className="underline underline-offset-4" to={`/destinations/${journalPlace.slug}`}>
                    {journalPlace.name}
                  </Link>
                </span>
              ) : null}
            </p>
          </div>
          <h1 className="journal-title font-serif">
            {journal.frontmatter.title}
          </h1>
        </div>
        <div className="prose-jewel">
          <Content />
        </div>
      </article>
    </>
  );
}
