import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { JournalFrontmatter } from "../lib/content";

type JournalListItemProps = {
  journal: JournalFrontmatter;
  placeName?: string;
  headingLevel?: "h2" | "h3";
  className?: string;
};

export function JournalListItem({
  journal,
  placeName,
  headingLevel = "h2",
  className = "py-7 first:pt-0",
}: JournalListItemProps) {
  const Heading = headingLevel;
  const year = journal.createdAt.slice(0, 4);

  return (
    <Link to={`/journals/${journal.slug}`} className={`journal-list-item ${className}`}>
      <time className="journal-list-item__year" dateTime={journal.createdAt} aria-label={`创建于${year}年`}>
        {year}
      </time>
      <div className="journal-list-item__content">
        <p className="journal-list-item__meta">
          创建于{" "}
          <time dateTime={journal.createdAt}>{journal.createdAt}</time>
          {placeName ? ` · ${placeName}` : ""}
        </p>
        <Heading className="journal-list-item__title font-serif">{journal.title}</Heading>
        <p className="journal-list-item__description">{journal.description}</p>
      </div>
      <span className="journal-list-item__arrow" aria-hidden="true">
        <ArrowUpRight size={17} strokeWidth={1.6} />
      </span>
    </Link>
  );
}
