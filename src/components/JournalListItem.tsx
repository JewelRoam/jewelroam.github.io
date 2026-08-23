import { Link } from "react-router-dom";
import type { JournalFrontmatter } from "../lib/content";

type JournalListItemProps = {
  journal: JournalFrontmatter;
  placeNames?: string[];
  headingLevel?: "h2" | "h3";
  className?: string;
};

export function JournalListItem({
  journal,
  placeNames = [],
  headingLevel = "h2",
  className = "py-7 first:pt-0",
}: JournalListItemProps) {
  const Heading = headingLevel;

  return (
    <Link to={`/journals/${journal.slug}`} className={`block ${className}`}>
      <p className="text-xs text-[#20211f]/50">
        创建于{" "}
        <time dateTime={journal.createdAt}>{journal.createdAt}</time>
        {placeNames.length ? ` · ${placeNames.join("、")}` : ""}
      </p>
      <Heading className="mt-2 font-serif text-2xl">{journal.title}</Heading>
      <p className="mt-2 leading-7 text-[#20211f]/65">{journal.description}</p>
    </Link>
  );
}
