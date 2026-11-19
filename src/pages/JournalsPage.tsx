import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { JournalListItem } from "../components/JournalListItem";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { WriteButton } from "../components/WriteButton";
import { getPlace, journals, photos } from "../lib/content";
import { isSameJournalPeriod } from "../lib/journal-date";
import "./JournalsPage.css";

const JournalSpace = lazy(() => import("../components/JournalSpace"));

export function JournalsPage() {
  const [headerActions, setHeaderActions] = useState<HTMLElement | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const previewTimerRef = useRef<number>(0);
  const journalEntries = useMemo(() => journals.map((journal, index) => ({
    index,
    journal: journal.frontmatter,
    placeName: getPlace(journal.frontmatter.placeId)?.name ?? journal.frontmatter.placeId,
    cover: photos
      .filter((photo) => photo.id.startsWith(`${journal.frontmatter.slug}-`))
      .sort((a, b) => a.id.localeCompare(b.id))[0],
  })), []);

  const schedulePreview = useCallback((slug: string) => {
    window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      setPreviewSlug(slug);
    }, 110);
  }, []);

  const clearPreview = useCallback(() => {
    window.clearTimeout(previewTimerRef.current);
    setPreviewSlug(null);
  }, []);

  useEffect(() => {
    setHeaderActions(document.getElementById("site-header-actions"));
    return () => window.clearTimeout(previewTimerRef.current);
  }, []);

  return (
    <div className="journals-page">
      {headerActions
        ? createPortal(<div className="journal-actions"><WriteButton /></div>, headerActions)
        : null}
      <section className="journals-page__stage" aria-label="Journals 空间画廊">
        <Suspense
          fallback={(
            <div className="journals-page__stage-loading">
              <LoadingIndicator size="large" label="载入画廊" />
            </div>
          )}
        >
          <JournalSpace entries={journalEntries} previewSlug={previewSlug} />
        </Suspense>
      </section>

      <section id="journal-index" className="journals-page__index" aria-label="文章目录">
        <header className="journals-page__header">
          <h1 className="page-title font-serif">Journals</h1>
        </header>
        <div
          className="journal-archive"
          onMouseLeave={clearPreview}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              clearPreview();
            }
          }}
        >
          {journalEntries.map((entry, index) => {
            const previousEntry = journalEntries[index - 1];

            return (
              <JournalListItem
                key={entry.journal.slug}
                journal={entry.journal}
                placeName={entry.placeName}
                dateMode={isSameJournalPeriod(
                  entry.journal.createdAt,
                  previousEntry?.journal.createdAt,
                ) ? "continuation" : "timeline"}
                onPreview={() => schedulePreview(entry.journal.slug)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
