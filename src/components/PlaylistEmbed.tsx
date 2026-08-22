type PlaylistItem = {
  title: string;
  href: string;
  platform: "Apple Music" | "网易云音乐";
};

function getAppleMusicEmbedUrl(href: string) {
  try {
    const url = new URL(href);
    if (url.hostname !== "music.apple.com") return null;

    url.hostname = "embed.music.apple.com";
    url.searchParams.set("app", "music");
    url.searchParams.set("itsct", "music_box_player");
    url.searchParams.set("itscg", "30200");
    url.searchParams.set("ls", "1");
    return url.toString();
  } catch {
    return null;
  }
}

function ExternalPlaylistLink({ item }: { item: PlaylistItem }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="playlist-link-row"
    >
      <span className="playlist-link-row__title">
        <span aria-hidden="true" className="playlist-link-row__mark">
          ♫
        </span>
        {item.title}
      </span>
      <span className="playlist-link-row__platform">
        {item.platform}
        <span aria-hidden="true">↗</span>
      </span>
    </a>
  );
}

export function PlaylistEmbed({ item }: { item: PlaylistItem }) {
  const embedUrl = item.platform === "Apple Music" ? getAppleMusicEmbedUrl(item.href) : null;

  if (!embedUrl) return <ExternalPlaylistLink item={item} />;

  return (
    <figure className="playlist-embed-frame">
      <figcaption className="playlist-embed-frame__caption">
        <span className="playlist-embed-frame__title">
          <span aria-hidden="true">♫</span>
          {item.title}
        </span>
        <a href={item.href} target="_blank" rel="noreferrer">
          Apple Music <span aria-hidden="true">↗</span>
        </a>
      </figcaption>
      <iframe
        className="playlist-embed"
        src={embedUrl}
        title={`${item.title} · Apple Music`}
        loading="lazy"
        allow="autoplay *; encrypted-media *;"
        frameBorder="0"
      />
    </figure>
  );
}

export type { PlaylistItem };
