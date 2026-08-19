import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ResponsiveImage } from "./components/ResponsiveImage";
import { getPhoto, getPost, getSeriesPhotos, photos, posts } from "./lib/content";

const ArticleEditor = import.meta.env.DEV
  ? lazy(() => import("./components/ArticleEditor").then((module) => ({ default: module.ArticleEditor })))
  : null;

function Home() {
  const feature = photos[0];
  const latestPost = posts[0];
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:px-10 lg:pt-24">
        <div>
          <p className="mb-5 text-xs uppercase tracking-[0.24em] text-[#20211f]/50">Notes from moving through the world</p>
          <h1 className="max-w-xl font-serif text-5xl leading-[1.02] tracking-[-0.02em] sm:text-7xl">把远方带回日常。</h1>
          <p className="mt-7 max-w-md text-base leading-7 text-[#20211f]/65">JewelRoam 是一个关于旅行、摄影与缓慢观察的个人档案。这里收集路上的光，也收集还没有被说完的故事。</p>
          <div className="mt-9 flex gap-5 text-sm">
            <Link to="/archive" className="border-b border-[#20211f] pb-1">浏览影像档案</Link>
            <Link to="/essays" className="border-b border-[#20211f]/30 pb-1 text-[#20211f]/65">阅读文字</Link>
          </div>
        </div>
        {feature && <ResponsiveImage photo={feature} priority sizes="(min-width: 1024px) 42vw, 100vw" className="aspect-[4/5] w-full object-cover" />}
      </section>
      <section className="mx-auto max-w-6xl border-t border-[#20211f]/10 px-6 py-16 lg:px-10">
        <div className="flex items-baseline justify-between"><h2 className="font-serif text-3xl">最近的记录</h2><Link to="/essays" className="text-sm text-[#20211f]/60">全部文字 →</Link></div>
        {latestPost && <Link to={`/essays/${latestPost.frontmatter.slug}`} className="mt-8 block border-b border-[#20211f]/10 pb-8 transition hover:border-[#20211f]/40"><p className="text-xs text-[#20211f]/50">创建于 <time dateTime={latestPost.frontmatter.createdAt}>{latestPost.frontmatter.createdAt}</time></p><h3 className="mt-3 font-serif text-2xl">{latestPost.frontmatter.title}</h3><p className="mt-3 max-w-xl leading-7 text-[#20211f]/65">{latestPost.frontmatter.description}</p></Link>}
      </section>
    </div>
  );
}

function Archive() {
  const series = [...new Set(photos.map((photo) => photo.series))];
  return <Page title="影像档案" intro="按系列保存那些值得回看的片刻。"><div className="grid gap-8 sm:grid-cols-2">{series.map((name) => { const first = getSeriesPhotos(name)[0]; return first ? <Link to={`/archive/${name}`} key={name} className="group"> <ResponsiveImage photo={first} sizes="(min-width: 640px) 45vw, 100vw" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]" /><div className="mt-4 flex justify-between text-sm"><span>{name}</span><span className="text-[#20211f]/50">{getSeriesPhotos(name).length} 张</span></div></Link> : null; })}</div></Page>;
}

function Series({ name }: { name: string }) {
  const seriesPhotos = getSeriesPhotos(name);
  if (!seriesPhotos.length) return <Navigate to="/archive" replace />;
  return <Page title={name} intro="一组关于天气、移动与停留的影像。"><div className="grid gap-6 sm:grid-cols-2">{seriesPhotos.map((photo) => <Link to={`/photos/${photo.id}`} key={photo.id}><ResponsiveImage photo={photo} sizes="(min-width: 640px) 45vw, 100vw" className="aspect-[4/3] w-full object-cover" /><div className="mt-3 text-sm">{photo.title}</div></Link>)}</div></Page>;
}

function Essays() {
  return <Page title="文字" intro="旅行不是抵达之后才开始的。"><div className="divide-y divide-[#20211f]/10">{posts.map((post) => <Link key={post.frontmatter.slug} to={`/essays/${post.frontmatter.slug}`} className="block py-7 first:pt-0"><p className="text-xs text-[#20211f]/50">创建于 <time dateTime={post.frontmatter.createdAt}>{post.frontmatter.createdAt}</time></p><h2 className="mt-2 font-serif text-2xl">{post.frontmatter.title}</h2><p className="mt-2 max-w-2xl leading-7 text-[#20211f]/65">{post.frontmatter.description}</p></Link>)}</div></Page>;
}

function Essay({ slug }: { slug: string }) {
  const post = getPost(slug);
  if (!post) return <Navigate to="/essays" replace />;
  const Content = post.default;
  return <article className="mx-auto max-w-3xl px-6 pb-20 pt-16 lg:px-10 lg:pt-24"><p className="text-xs text-[#20211f]/50">创建于 <time dateTime={post.frontmatter.createdAt}>{post.frontmatter.createdAt}</time></p><h1 className="mt-4 font-serif text-5xl leading-tight">{post.frontmatter.title}</h1><p className="mt-6 text-lg leading-8 text-[#20211f]/65">{post.frontmatter.description}</p><div className="prose-jewel mt-14"><Content /></div></article>;
}

function Photo({ id }: { id: string }) {
  const photo = getPhoto(id);
  if (!photo) return <Navigate to="/archive" replace />;
  return <article className="mx-auto max-w-6xl px-6 pb-20 pt-12 lg:px-10"><ResponsiveImage photo={photo} priority sizes="(min-width: 1024px) 88vw, 100vw" className="max-h-[78vh] w-full object-contain" /><div className="mt-7 flex flex-wrap justify-between gap-5 border-t border-[#20211f]/10 pt-5 text-sm"><div><h1 className="font-serif text-2xl">{photo.title}</h1><p className="mt-2 text-[#20211f]/55">{photo.location} · {photo.takenAt}</p></div><p className="max-w-xs text-right text-[#20211f]/55">{photo.rights.notice}<br /><Link to="/rights" className="underline underline-offset-4">查看许可</Link></p></div></article>;
}

function Page({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) { return <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 lg:px-10 lg:pt-24"><h1 className="font-serif text-5xl">{title}</h1><p className="mt-5 max-w-xl leading-7 text-[#20211f]/65">{intro}</p><div className="mt-14">{children}</div></section>; }

function About() { return <Page title="关于" intro="JewelRoam 是一个私人影像与文字档案。"><div className="max-w-2xl space-y-6 text-lg leading-9 text-[#20211f]/75"><p>我在路上拍照，也在回到房间之后写下那些没有被相机记录的部分。</p><p>这里没有目的地清单，只有一些关于光线、陌生城市和日常停顿的观察。</p></div></Page>; }
function Rights() { return <Page title="使用与许可" intro="公开页面中的文章与图片默认保留全部权利。"><div className="max-w-2xl space-y-5 leading-8 text-[#20211f]/70"><p>除非页面另有说明，站内内容不得复制、改编、转载或用于商业用途。</p><p>如需转载、出版、展览或商业授权，请通过项目维护者提供的联系方式说明使用范围、媒介和期限。</p><p className="text-sm">图片发行版本会保留版权与来源元数据；原始文件和高分辨率母版不公开。</p></div></Page>; }

export function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/archive" element={<Archive />} /><Route path="/archive/:series" element={<SeriesRoute />} /><Route path="/photos/:id" element={<PhotoRoute />} /><Route path="/essays" element={<Essays />} /><Route path="/essays/:slug" element={<EssayRoute />} /><Route path="/about" element={<About />} /><Route path="/rights" element={<Rights />} /><Route path="/editor" element={<EditorRoute />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}

function EditorRoute() {
  if (!ArticleEditor) return <Navigate to="/" replace />;
  return <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-20 text-sm text-[#20211f]/55">正在打开编辑器…</div>}><ArticleEditor /></Suspense>;
}

function SeriesRoute() { return <Series name={decodeURIComponent(location.pathname.split("/").pop() || "")} />; }
function PhotoRoute() { return <Photo id={decodeURIComponent(location.pathname.split("/").pop() || "")} />; }
function EssayRoute() { return <Essay slug={decodeURIComponent(location.pathname.split("/").pop() || "")} />; }
