import { JournalListItem } from "../components/JournalListItem";
import { Page } from "../components/Page";
import { getPlace, journals } from "../lib/content";
import { isSameJournalPeriod } from "../lib/journal-date";

export function JournalsPage() {
  return (
    <Page title="Journals" intro="旅行不是抵达之后才开始的。文章均为手写，但简介和图片详情中的文字描述为 AI 概括，或有所偏差。">
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
    </Page>
  );
}
