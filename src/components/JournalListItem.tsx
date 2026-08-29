import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { JournalFrontmatter } from "../lib/content";
import { getJournalDateParts } from "../lib/journal-date";

type JournalListItemProps = {
  journal: JournalFrontmatter;
  placeName?: string;
  dateMode: "timeline" | "continuation" | "exact";
  headingLevel?: "h2" | "h3";
  className?: string;
};

export function JournalListItem({
  journal,
  placeName,
  dateMode,
  headingLevel = "h2",
  className = "py-7 first:pt-0",
}: JournalListItemProps) {
  const Heading = headingLevel;
  const { year, month } = getJournalDateParts(journal.createdAt);
  const timelineDate = dateMode === "timeline"
    ? (
        <time className="journal-list-item__date" dateTime={journal.createdAt} aria-label={`创建于${year}年${month}月`}>
          <span className="journal-list-item__year">{year}</span>
          <span className="journal-list-item__month">{month}</span>
        </time>
      )
    : dateMode === "continuation"
      ? <span className="journal-list-item__date journal-list-item__date--continuation" aria-hidden="true" />
      : null;
  const metadata = dateMode === "exact"
    ? (
        <>
          创建于 <time dateTime={journal.createdAt}>{journal.createdAt}</time>
          {placeName ? ` · ${placeName}` : ""}
        </>
      )
    : placeName;

  return (
    <Link to={`/journals/${journal.slug}`} className={`journal-list-item ${className}`}>
      {timelineDate}
      <div className="journal-list-item__content">
        {metadata ? <p className="journal-list-item__meta">{metadata}</p> : null}
        <Heading className="journal-list-item__title font-serif">{journal.title}</Heading>
        <p className="journal-list-item__description">{journal.description}</p>
      </div>
      <span className="journal-list-item__arrow" aria-hidden="true">
        <ArrowUpRight size={17} strokeWidth={1.6} />
      </span>
    </Link>
  );
}
