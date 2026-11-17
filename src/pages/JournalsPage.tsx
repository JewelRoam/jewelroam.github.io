import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { JournalListItem } from "../components/JournalListItem";
import { JournalRing } from "../components/JournalRing";
import { WriteButton } from "../components/WriteButton";
import { getPlace, journals } from "../lib/content";
import { isSameJournalPeriod } from "../lib/journal-date";
import "./JournalsPage.css";

export function JournalsPage() {
  const [headerActions, setHeaderActions] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderActions(document.getElementById("site-header-actions"));
  }, []);

  return (
    <div className="journals-page">
      {headerActions
        ? createPortal(<div className="journal-actions"><WriteButton /></div>, headerActions)
        : null}
      <JournalRing />
      <section id="journal-index" className="journals-page__index" aria-label="文章目录">
        <div className="journal-archive">
          {journals.map((journal, index) => {
            const journalPlace = getPlace(journal.frontmatter.placeId);
            const previousJournal = journals[index - 1];

            return (
              <JournalListItem
                key={journal.frontmatter.slug}
                journal={journal.frontmatter}
                placeName={journalPlace?.name ?? journal.frontmatter.placeId}
                dateMode={isSameJournalPeriod(
                  journal.frontmatter.createdAt,
                  previousJournal?.frontmatter.createdAt,
                ) ? "continuation" : "timeline"}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
