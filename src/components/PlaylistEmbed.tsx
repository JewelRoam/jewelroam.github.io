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

function getNeteaseMusicEmbedUrl(href: string) {
  try {
    const url = new URL(href);
    if (url.hostname !== "music.163.com") return null;

    const hashQuery = url.hash.split("?")[1];
    const id = hashQuery ? new URLSearchParams(hashQuery).get("id") : null;
    if (!id || !/^\d+$/.test(id)) return null;

    const embedUrl = new URL("https://music.163.com/outchain/player");
    embedUrl.searchParams.set("type", "0");
    embedUrl.searchParams.set("id", id);
    embedUrl.searchParams.set("auto", "0");
    embedUrl.searchParams.set("height", "360");
    return embedUrl.toString();
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
  const embedUrl =
    item.platform === "Apple Music"
      ? getAppleMusicEmbedUrl(item.href)
      : getNeteaseMusicEmbedUrl(item.href);

  if (!embedUrl) return <ExternalPlaylistLink item={item} />;

  const platformClass = item.platform === "Apple Music" ? "apple" : "netease";

  return (
    <figure className="playlist-embed-frame">
      <figcaption className="playlist-embed-frame__caption">
        <span className="playlist-embed-frame__title">
          <span aria-hidden="true">♫</span>
          {item.title}
        </span>
        <a href={item.href} target="_blank" rel="noreferrer">
          {item.platform} <span aria-hidden="true">↗</span>
        </a>
      </figcaption>
      <iframe
        className={`playlist-embed playlist-embed--${platformClass}`}
        src={embedUrl}
        title={`${item.title} · ${item.platform}`}
        loading={item.platform === "Apple Music" ? "lazy" : "eager"}
        allow="autoplay *; encrypted-media *;"
        frameBorder="0"
      />
    </figure>
  );
}

export type { PlaylistItem };
