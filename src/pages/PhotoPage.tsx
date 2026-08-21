import { Link, Navigate, useParams } from "react-router-dom";
import { ResponsiveImage } from "../components/ResponsiveImage";
import { getPhoto, getPlace } from "../lib/content";

export function PhotoPage() {
  const id = decodeURIComponent(useParams().id || "");
  const photo = getPhoto(id);

  if (!photo) return <Navigate to="/destinations" replace />;

  const place = getPlace(photo.placeId);

  return (
    <article className="page-shell">
      <ResponsiveImage
        photo={photo}
        priority
        sizes="(min-width: 1024px) 88vw, 100vw"
        className="max-h-[78vh] w-full object-contain"
      />
      <div className="mt-7 flex flex-wrap justify-between gap-5 border-t border-[#20211f]/10 pt-5 text-sm">
        <div>
          <h1 className="font-serif text-2xl">{photo.title}</h1>
          <p className="mt-2 text-[#20211f]/55">
            {place?.name ?? "未标注地点"} · {photo.takenAt}
          </p>
        </div>
        <p className="max-w-xs text-right text-[#20211f]/55">
          {photo.rights.notice}
          <br />
          <Link to="/jewelroam#rights" className="underline underline-offset-4">
            查看使用与许可
          </Link>
        </p>
      </div>
    </article>
  );
}
