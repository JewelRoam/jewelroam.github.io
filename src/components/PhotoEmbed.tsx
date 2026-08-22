import { Link } from "react-router-dom";
import { getPhoto } from "../lib/content";
import { ArticleImage, ArticleMedia } from "./ArticleMedia";

export function PhotoEmbed({ id, caption }: { id: string; caption?: string }) {
  const photo = getPhoto(id);
  if (!photo) {
    return (
      <ArticleMedia>
        <p className="article-media__missing" role="alert">图片引用缺失：{id}</p>
      </ArticleMedia>
    );
  }

  return (
    <ArticleMedia>
      <Link
        to={`/photos/${photo.id}`}
        className="article-media__link"
        aria-label={`查看${photo.title}详情`}
      >
        <ArticleImage photo={photo} caption={caption} />
      </Link>
    </ArticleMedia>
  );
}
