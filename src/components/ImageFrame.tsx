import type { ReactNode } from "react";

type ImageFrameProps = {
  children: ReactNode;
  caption?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Shared image frame; loading, routing, and editing actions stay with callers. */
export function ImageFrame({ children, caption, action, className }: ImageFrameProps) {
  return (
    <figure className={`media-frame${className ? ` ${className}` : ""}`}>
      {children}
      {action}
      {caption && <figcaption className="media-frame__caption">{caption}</figcaption>}
    </figure>
  );
}
