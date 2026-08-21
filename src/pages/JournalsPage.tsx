import { Link } from "react-router-dom";
import { Page } from "../components/Page";
import { getPlace, journals } from "../lib/content";

export function JournalsPage() {
  return (
    <Page title="Journals" intro="旅行不是抵达之后才开始的。">
      <div className="divide-y divide-[#20211f]/10">
        {journals.map((journal) => {
          const place = getPlace(journal.frontmatter.placeId);

          return (
            <Link
              key={journal.frontmatter.slug}
              to={`/journals/${journal.frontmatter.slug}`}
              className="block py-7 first:pt-0"
            >
              <p className="text-xs text-[#20211f]/50">
                创建于{" "}
                <time dateTime={journal.frontmatter.createdAt}>
                  {journal.frontmatter.createdAt}
                </time>
                {place ? ` · ${place.name}` : ""}
              </p>
              <h2 className="mt-2 font-serif text-2xl">
                {journal.frontmatter.title}
              </h2>
              <p className="mt-2 leading-7 text-[#20211f]/65">
                {journal.frontmatter.description}
              </p>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
