import { Navigate, useParams } from "react-router-dom";
import { ImageFrame } from "../components/ImageFrame";
import { PhotoLoupe } from "../components/PhotoLoupe";
import { getPhoto, getPlace } from "../lib/content";

export function PhotoPage() {
  const id = decodeURIComponent(useParams().id || "");
  const photo = getPhoto(id);

  if (!photo) return <Navigate to="/destinations" replace />;

  const place = getPlace(photo.placeId);

  return (
    <article className="page-shell photo-detail">
      <ImageFrame className="photo-detail__frame">
        <PhotoLoupe
          photo={photo}
          priority
          className="media-frame__image photo-page__image"
        />
      </ImageFrame>
      <div className="photo-detail__meta">
        <div>
          <h1 className="photo-detail__title">{photo.title}</h1>
          <p className="photo-detail__place">
            {place?.name ?? "未标注地点"} · {photo.takenAt}
          </p>
        </div>
        <p className="photo-detail__rights">{photo.rights.notice}</p>
      </div>
    </article>
  );
}
