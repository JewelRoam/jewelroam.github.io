import { useEffect, useState } from "react";
import { ArrowUpRight, Music2 } from "lucide-react";

const PLAYER_SLOW_TIMEOUT = 6000;

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
          <Music2 size={16} strokeWidth={1.6} />
        </span>
        {item.title}
      </span>
      <span className="playlist-link-row__platform">
        {item.platform}
        <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
      </span>
    </a>
  );
}

export function PlaylistEmbed({ item }: { item: PlaylistItem }) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "slow" | "error">("loading");
  const embedUrl =
    item.platform === "Apple Music"
      ? getAppleMusicEmbedUrl(item.href)
      : getNeteaseMusicEmbedUrl(item.href);

  useEffect(() => {
    if (!embedUrl) return undefined;
    const frame = window.requestAnimationFrame(() => setShouldLoad(true));
    return () => window.cancelAnimationFrame(frame);
  }, [embedUrl]);

  useEffect(() => {
    if (!embedUrl || !shouldLoad || status === "ready" || status === "error") return undefined;
    const timeout = window.setTimeout(() => setStatus("slow"), PLAYER_SLOW_TIMEOUT);
    return () => window.clearTimeout(timeout);
  }, [embedUrl, shouldLoad, status]);

  if (!embedUrl) return <ExternalPlaylistLink item={item} />;

  const platformClass = item.platform === "Apple Music" ? "apple" : "netease";

  return (
    <figure className="playlist-embed-frame">
      <figcaption className="playlist-embed-frame__caption">
        <span className="playlist-embed-frame__title">
          <Music2 size={16} strokeWidth={1.6} aria-hidden="true" />
          {item.title}
        </span>
        <a href={item.href} target="_blank" rel="noreferrer">
          {item.platform} <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" />
        </a>
      </figcaption>
      <div className={`playlist-embed-shell playlist-embed-shell--${status}`}>
        {!shouldLoad && (
          <div className={`playlist-embed playlist-embed--${platformClass} playlist-embed-placeholder`} role="status">
            正在加载播放器…
          </div>
        )}
        {shouldLoad && (
          <iframe
            className={`playlist-embed playlist-embed--${platformClass}`}
            src={embedUrl}
            title={`${item.title} · ${item.platform}`}
            loading="eager"
            allow="autoplay *; encrypted-media *;"
            frameBorder="0"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
        )}
        {status === "slow" && (
          <p className="playlist-embed-status" role="status">
            播放器加载较慢，<a href={item.href} target="_blank" rel="noreferrer">打开 {item.platform}</a>
          </p>
        )}
        {status === "error" && (
          <p className="playlist-embed-status" role="alert">
            播放器暂时不可用，<a href={item.href} target="_blank" rel="noreferrer">打开 {item.platform}</a>
          </p>
        )}
      </div>
    </figure>
  );
}

export type { PlaylistItem };
