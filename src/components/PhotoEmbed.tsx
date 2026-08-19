import { getPhoto } from "../lib/content";
import { ResponsiveImage } from "./ResponsiveImage";

export function PhotoEmbed({ id, caption }: { id: string; caption?: string }) {
  const photo = getPhoto(id);
  if (!photo) return null;

  return (
    <figure className="my-12">
      <ResponsiveImage photo={photo} sizes="(min-width: 768px) 48rem, 100vw" className="w-full" />
      {caption && <figcaption className="mt-3 text-sm text-[#20211f]/55">{caption}</figcaption>}
    </figure>
  );
}
