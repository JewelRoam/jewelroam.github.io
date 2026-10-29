import { JournalListItem } from "../components/JournalListItem";
import { JournalRing } from "../components/JournalRing";
import { getPlace, journals } from "../lib/content";
import { isSameJournalPeriod } from "../lib/journal-date";
import "./JournalsPage.css";

export function JournalsPage() {
  return (
    <div className="journals-page">
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
