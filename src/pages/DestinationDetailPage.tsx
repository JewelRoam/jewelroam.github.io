import { Link, Navigate, useParams } from "react-router-dom";
import { Page } from "../components/Page";
import { ImageFrame } from "../components/ImageFrame";
import { JournalListItem } from "../components/JournalListItem";
import { ResponsiveImage } from "../components/ResponsiveImage";
import { getPlace, getPlaceJournals, getPlacePhotos } from "../lib/content";

export function DestinationDetailPage() {
  const slug = decodeURIComponent(useParams().slug || "");
  const place = getPlace(slug);

  if (!place) return <Navigate to="/destinations" replace />;

  const placePhotos = getPlacePhotos(place.id);
  const placeJournals = getPlaceJournals(place.id);

  return (
    <Page
      className="page-detail"
      title={place.name}
      intro={
        [place.region, place.country].filter(Boolean).join(" · ") ||
        "一处被记录的停留。"
      }
    >
      <div className="space-y-16">
        {placePhotos.length > 0 && (
          <section>
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl">Photos</h2>
              <span className="text-sm text-[#20211f]/50">
                {placePhotos.length} 张
              </span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {placePhotos.map((photo) => (
                <Link
                  to={`/photos/${photo.id}`}
                  key={photo.id}
                  className="group"
                >
                  <ImageFrame>
                    <ResponsiveImage
                      photo={photo}
                      sizes="(min-width: 640px) 45vw, 100vw"
                      className="media-frame__image mx-auto transition duration-500 group-hover:scale-[1.02]"
                    />
                  </ImageFrame>
                  <div className="mt-3 text-sm">{photo.title}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl">Journals</h2>
            <span className="text-sm text-[#20211f]/50">
              {placeJournals.length} 篇
            </span>
          </div>
          {placeJournals.length ? (
            <div className="divide-y divide-[#20211f]/10">
              {placeJournals.map((journal) => (
                <JournalListItem
                  key={journal.frontmatter.slug}
                  journal={journal.frontmatter}
                  dateMode="exact"
                  headingLevel="h3"
                  className="py-6 first:pt-0"
                />
              ))}
            </div>
          ) : (
            <p className="text-[#20211f]/55">这个地点还没有 Journal。</p>
          )}
        </section>
      </div>
    </Page>
  );
}
