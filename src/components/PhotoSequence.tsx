import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getPhoto } from "../lib/content";
import { createJustifiedGeometry } from "../lib/photo-layout";
import { ArticleImage, ArticleMedia } from "./ArticleMedia";

const JUSTIFIED_MIN_WIDTH = 768;

export function PhotoSequence({ ids }: { ids: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const entries = useMemo(() => ids.map((id) => ({ id, photo: getPhoto(id) })), [ids]);
  const hasMissingPhoto = entries.some(({ photo }) => !photo);
  const geometry = useMemo(() => {
    if (containerWidth < JUSTIFIED_MIN_WIDTH || hasMissingPhoto) return null;
    return createJustifiedGeometry(
      entries.map(({ photo }) => photo!.dimensions.width / photo!.dimensions.height),
      containerWidth,
      "reading",
    );
  }, [containerWidth, entries, hasMissingPhoto]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const width = Math.round(container.getBoundingClientRect().width);
      setContainerWidth((current) => current === width ? current : width);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (!entries.length) return null;

  return (
    <ArticleMedia layout="sequence">
      <div
        ref={containerRef}
        className={`article-media__sequence${geometry ? " is-justified" : ""}`}
        style={geometry ? { height: geometry.containerHeight } : undefined}
      >
        {entries.map(({ id, photo }, index) => photo ? (
          <Link
            key={`${id}-${index}`}
            to={`/photos/${photo.id}`}
            className="article-media__link"
            aria-label={`查看${photo.title}详情`}
            style={geometry ? geometry.boxes[index] : undefined}
          >
            <ArticleImage
              photo={photo}
              fill
              sizes="(min-width: 1280px) 34vw, (min-width: 768px) 50vw, 100vw"
            />
          </Link>
        ) : (
          <p key={`${id}-${index}`} className="article-media__missing" role="alert">图片引用缺失：{id}</p>
        ))}
      </div>
    </ArticleMedia>
  );
}
