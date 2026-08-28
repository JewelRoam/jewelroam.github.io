import { Link, Navigate, useParams } from "react-router-dom";
import { FilmPerforations } from "../components/FilmPerforations";
import { ImageFrame } from "../components/ImageFrame";
import { PhotoLoupe } from "../components/PhotoLoupe";
import { OriginalImage, ResponsiveImage } from "../components/ResponsiveImage";
import { getPhoto, getPlace, getPlacePhotos, type Photo } from "../lib/content";

function comparePhotos(left: Photo, right: Photo) {
  return left.takenAt.localeCompare(right.takenAt) || left.id.localeCompare(right.id);
}

type FilmStripProps = {
  currentPhoto: Photo;
  previousPhoto?: Photo;
  nextPhoto?: Photo;
  sample?: boolean;
};

function FilmNeighbor({ photo, side, sample }: {
  photo: Photo;
  side: "previous" | "next";
  sample: boolean;
}) {
  const className = `photo-detail__neighbor photo-detail__neighbor--${side}`;
  const image = (
    <ResponsiveImage
      photo={photo}
      width={640}
      sizes="(min-width: 641px) 18vw, 14vw"
      draggable={false}
      aria-hidden="true"
    />
  );

  if (sample) return <div className={className}>{image}</div>;

  return (
    <Link
      className={className}
      to={`/photos/${photo.id}`}
      aria-label={`查看${side === "previous" ? "上一张" : "下一张"}：${photo.title}`}
    >
      {image}
    </Link>
  );
}

function FilmStrip({ currentPhoto, previousPhoto, nextPhoto, sample = false }: FilmStripProps) {
  const modifiers = `${previousPhoto ? " has-previous" : ""}${nextPhoto ? " has-next" : ""}`;

  return (
    <div
      className={`photo-detail__film-strip${sample ? " photo-detail__film-strip--sample" : ""}${modifiers}`}
      aria-hidden={sample || undefined}
    >
      {previousPhoto ? (
        <FilmNeighbor photo={previousPhoto} side="previous" sample={sample} />
      ) : null}
      <div
        className="photo-detail__current"
        data-loupe-rest-target={sample ? undefined : ""}
      >
        <OriginalImage
          photo={currentPhoto}
          priority={!sample}
          className="media-frame__image photo-page__image"
          draggable={false}
          aria-hidden={sample || undefined}
        />
      </div>
      {nextPhoto ? <FilmNeighbor photo={nextPhoto} side="next" sample={sample} /> : null}
    </div>
  );
}

function PhotoSurface({
  photo,
  previousPhoto,
  nextPhoto,
  placeName,
  sample = false,
}: {
  photo: Photo;
  previousPhoto?: Photo;
  nextPhoto?: Photo;
  placeName?: string;
  sample?: boolean;
}) {
  const modifiers = `${previousPhoto ? " has-previous" : ""}${nextPhoto ? " has-next" : ""}`;

  return (
    <div
      className={`photo-detail__surface${sample ? " photo-detail__surface--sample" : ""}`}
      aria-hidden={sample || undefined}
    >
      <ImageFrame
        className={`photo-detail__frame${modifiers}`}
        caption={(
          <div className="photo-detail__meta">
            <div className="photo-detail__identity">
              <h1 className="photo-detail__title">{photo.title}</h1>
              <p className="photo-detail__place">
                {placeName ?? "未标注地点"} · {photo.takenAt}
              </p>
            </div>
            <p className="photo-detail__rights">{photo.rights.notice}</p>
          </div>
        )}
      >
        <div className="photo-detail__transparency">
          <FilmPerforations />
          <FilmStrip
            currentPhoto={photo}
            previousPhoto={previousPhoto}
            nextPhoto={nextPhoto}
            sample={sample}
          />
        </div>
      </ImageFrame>
    </div>
  );
}

export function PhotoPage() {
  const id = decodeURIComponent(useParams().id || "");
  const photo = getPhoto(id);

  if (!photo) return <Navigate to="/destinations" replace />;

  const place = getPlace(photo.placeId);
  const placePhotos = [...getPlacePhotos(photo.placeId)].sort(comparePhotos);
  const photoIndex = placePhotos.findIndex((candidate) => candidate.id === photo.id);
  const hasNeighbors = placePhotos.length > 1 && photoIndex >= 0;
  const previousPhoto = hasNeighbors
    ? placePhotos[(photoIndex - 1 + placePhotos.length) % placePhotos.length]
    : undefined;
  const nextPhoto = hasNeighbors
    ? placePhotos[(photoIndex + 1) % placePhotos.length]
    : undefined;

  return (
    <article className="page-shell photo-detail">
      <PhotoLoupe
        sample={(
          <PhotoSurface
            photo={photo}
            previousPhoto={previousPhoto}
            nextPhoto={nextPhoto}
            placeName={place?.name}
            sample
          />
        )}
      >
        <PhotoSurface
          photo={photo}
          previousPhoto={previousPhoto}
          nextPhoto={nextPhoto}
          placeName={place?.name}
        />
      </PhotoLoupe>
    </article>
  );
}
