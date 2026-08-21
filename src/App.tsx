import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { ResponsiveImage } from "./components/ResponsiveImage";
import { DestinationMap } from "./components/DestinationMap";
import { getJournal, getPhoto, getPlace, getPlaceJournals, getPlacePhotos, journals, photos, places } from "./lib/content";

const ArticleEditor = lazy(() => import("./components/ArticleEditor").then((module) => ({ default: module.ArticleEditor })));

const playlistGroups = [
  {
    label: "2019-2026",
    items: [
      ["2026 интуиция", "https://music.apple.com/cn/playlist/2026-%D0%B8%D0%BD%D1%82%D1%83%D0%B8%D1%86%D0%B8%D1%8F/pl.u-gxblgG7t5vZ91kN"],
      ["2026 задумываться", "https://music.apple.com/cn/playlist/2026-%D0%B7%D0%B0%D0%B4%D1%83%D0%BC%D1%8B%D0%B2%D0%B0%D1%82%D1%8C%D1%81%D1%8F/pl.u-GgA5ka5sZep4gjJ"],
      ["2024-2025 Annihilation or Petrification?", "https://music.apple.com/cn/playlist/2024-2025-annihilation-or-petrification/pl.u-WabZvAVudmYa7xB"],
      ["2023 Spanning", "https://music.apple.com/cn/playlist/2023-spanning/pl.u-NpXmza7tmB7oqk2"],
      ["2022 monument", "https://music.apple.com/cn/playlist/2022-monument/pl.u-WabZv4ZidmYa7xB"],
      ["2021 inner film", "https://music.apple.com/cn/playlist/2021-inner-film/pl.u-NpXmzeWFmB7oqk2"],
      ["2019-2020 watch the matter", "https://music.apple.com/cn/playlist/2019-2020-watch-the-matter/pl.u-jV890vLud63xKMr"],
    ],
  },
  {
    label: "2019 之前",
    items: [
      ["ρ", "https://music.163.com/#/playlist?id=8387263303"],
      ["ξ", "https://music.163.com/#/playlist?id=6613502033"],
      ["γ", "https://music.163.com/#/playlist?id=5168675317"],
      ["Ω", "https://music.163.com/#/playlist?id=5169873370"],
    ],
  },
] as const;

function Destinations() {
  const destinations = places.map((place) => ({ id: place.id, slug: place.slug, name: place.name, center: [place.coordinates.longitude, place.coordinates.latitude] as [number, number], geometry: place.geometry }));
  return <Page title="Destinations" intro="在地图上回看那些曾经停留的地方。"><DestinationMap destinations={destinations} onSelect={(place) => { window.location.href = `/destinations/${place.slug}`; }} /></Page>;
}

function DestinationDetail({ slug }: { slug: string }) {
  const place = getPlace(slug);
  if (!place) return <Navigate to="/destinations" replace />;
  const placePhotos = getPlacePhotos(place.id); const placeJournals = getPlaceJournals(place.id);
  return <Page title={place.name} intro={[place.region, place.country].filter(Boolean).join(" · ") || "一处被记录的停留。"}><div className="space-y-16">
    {placePhotos.length > 0 && <section><div className="mb-6 flex items-baseline justify-between"><h2 className="font-serif text-2xl">Photos</h2><span className="text-sm text-[#20211f]/50">{placePhotos.length} 张</span></div><div className="grid gap-6 sm:grid-cols-2">{placePhotos.map((photo) => <Link to={`/photos/${photo.id}`} key={photo.id} className="group"><ResponsiveImage photo={photo} sizes="(min-width: 640px) 45vw, 100vw" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]" /><div className="mt-3 text-sm">{photo.title}</div></Link>)}</div></section>}
    <section><div className="mb-6 flex items-baseline justify-between"><h2 className="font-serif text-2xl">Journals</h2><span className="text-sm text-[#20211f]/50">{placeJournals.length} 篇</span></div>{placeJournals.length ? <div className="divide-y divide-[#20211f]/10">{placeJournals.map((journal) => <Link key={journal.frontmatter.slug} to={`/journals/${journal.frontmatter.slug}`} className="block py-6 first:pt-0"><p className="text-xs text-[#20211f]/50">创建于 <time dateTime={journal.frontmatter.createdAt}>{journal.frontmatter.createdAt}</time></p><h3 className="mt-2 font-serif text-2xl">{journal.frontmatter.title}</h3><p className="mt-2 max-w-2xl leading-7 text-[#20211f]/65">{journal.frontmatter.description}</p></Link>)}</div> : <p className="text-[#20211f]/55">这个地点还没有 Journal。</p>}</section>
  </div></Page>;
}

function Journals() { return <Page title="Journals" intro="旅行不是抵达之后才开始的。"><div className="divide-y divide-[#20211f]/10">{journals.map((journal) => { const place = getPlace(journal.frontmatter.placeId); return <Link key={journal.frontmatter.slug} to={`/journals/${journal.frontmatter.slug}`} className="block py-7 first:pt-0"><p className="text-xs text-[#20211f]/50">创建于 <time dateTime={journal.frontmatter.createdAt}>{journal.frontmatter.createdAt}</time>{place ? ` · ${place.name}` : ""}</p><h2 className="mt-2 font-serif text-2xl">{journal.frontmatter.title}</h2><p className="mt-2 max-w-2xl leading-7 text-[#20211f]/65">{journal.frontmatter.description}</p></Link>; })}</div></Page>; }

function Journal({ slug }: { slug: string }) { const journal = getJournal(slug); if (!journal) return <Navigate to="/journals" replace />; const Content = journal.default; const place = getPlace(journal.frontmatter.placeId); return <article className="mx-auto max-w-3xl px-6 pb-20 pt-16 lg:px-10 lg:pt-24"><p className="text-xs text-[#20211f]/50">创建于 <time dateTime={journal.frontmatter.createdAt}>{journal.frontmatter.createdAt}</time>{place ? <> · <Link className="underline underline-offset-4" to={`/destinations/${place.slug}`}>{place.name}</Link></> : null}</p><h1 className="mt-4 font-serif text-5xl leading-tight">{journal.frontmatter.title}</h1><p className="mt-6 text-lg leading-8 text-[#20211f]/65">{journal.frontmatter.description}</p><div className="prose-jewel mt-14"><Content /></div></article>; }

function Photo({ id }: { id: string }) { const photo = getPhoto(id); if (!photo) return <Navigate to="/destinations" replace />; const place = getPlace(photo.placeId); return <article className="mx-auto max-w-6xl px-6 pb-20 pt-12 lg:px-10"><ResponsiveImage photo={photo} priority sizes="(min-width: 1024px) 88vw, 100vw" className="max-h-[78vh] w-full object-contain" /><div className="mt-7 flex flex-wrap justify-between gap-5 border-t border-[#20211f]/10 pt-5 text-sm"><div><h1 className="font-serif text-2xl">{photo.title}</h1><p className="mt-2 text-[#20211f]/55">{place?.name ?? "未标注地点"} · {photo.takenAt}</p></div><p className="max-w-xs text-right text-[#20211f]/55">{photo.rights.notice}<br /><Link to="/about#rights" className="underline underline-offset-4">查看使用与许可</Link></p></div></article>; }

function Page({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) { return <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 lg:px-10 lg:pt-24"><h1 className="font-serif text-5xl">{title}</h1><p className="mt-5 max-w-xl leading-7 text-[#20211f]/65">{intro}</p><div className="mt-14">{children}</div></section>; }
function About() { return <Page title="About" intro="JewelRoam 是我的 ID，这里是我的个人网站。"><div className="max-w-2xl space-y-6 text-lg leading-9 text-[#20211f]/75"><p>我在路上拍照，也在回到房间之后写下那些没有被相机记录的部分。这里没有目的地清单，只有一些关于光线、陌生城市和日常停顿的观察。</p><p>照片和 Journals 在这里沿着地点重新相遇。它们不是旅行攻略，也不试图列出完整的世界，只是我愿意留下的个人观察。</p><section className="border-t border-[#20211f]/10 pt-8"><h2 className="font-serif text-2xl text-[#20211f]">Playlists</h2><div className="mt-6 space-y-8 text-base leading-7"><p className="text-[#20211f]/60">一些陪我走过不同年份的声音。</p>{playlistGroups.map((group) => <div key={group.label}><h3 className="text-xs uppercase tracking-[0.16em] text-[#20211f]/50">{group.label}</h3><ul className="mt-3 space-y-2">{group.items.map(([title, href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-2 underline decoration-[#20211f]/20 underline-offset-4 transition hover:decoration-[#20211f]/70">{title}<span aria-hidden="true" className="no-underline text-xs text-[#20211f]/40">↗</span></a></li>)}</ul></div>)}</div></section><section id="rights" className="border-t border-[#20211f]/10 pt-8"><h2 className="font-serif text-2xl text-[#20211f]">使用与许可</h2><div className="mt-5 space-y-5 text-base leading-8"><p>公开页面中的文章与图片默认保留全部权利。除非页面另有说明，站内内容不得复制、改编、转载或用于商业用途。</p><p>如需转载、出版、展览或商业授权，请通过项目维护者提供的联系方式说明使用范围、媒介和期限。</p><p className="text-sm">图片发行版本会保留版权与来源元数据；原始文件和高分辨率母版不公开。</p></div></section></div></Page>; }

export function App() { return <Routes><Route path="/" element={<Navigate to="/about" replace />} /><Route path="/destinations" element={<Destinations />} /><Route path="/destinations/:slug" element={<DestinationRoute />} /><Route path="/photos/:id" element={<PhotoRoute />} /><Route path="/journals" element={<Journals />} /><Route path="/journals/:slug" element={<JournalRoute />} /><Route path="/about" element={<About />} /><Route path="/editor" element={<EditorRoute />} /><Route path="*" element={<Navigate to="/about" replace />} /></Routes>; }
function EditorRoute() { return <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-20 text-sm text-[#20211f]/55">正在打开编辑器…</div>}><ArticleEditor /></Suspense>; }
function DestinationRoute() { return <DestinationDetail slug={decodeURIComponent(useParams().slug || "")} />; }
function PhotoRoute() { return <Photo id={decodeURIComponent(useParams().id || "")} />; }
function JournalRoute() { return <Journal slug={decodeURIComponent(useParams().slug || "")} />; }
