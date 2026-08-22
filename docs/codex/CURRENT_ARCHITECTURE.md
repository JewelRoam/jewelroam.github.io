# 当前架构与设计约束

## 页面结构

核心导航固定为四项，另有一个外链预留入口：

- `Destinations`：以 MapLibre 渲染的全视口地点地图；地点悬停抬升，点击进入地点归档。生产构建会将 MapLibre worker 及其 shared 模块作为静态资源一并发布，确保 GitHub Pages 上的 GeoJSON 图层正常渲染。
- `Journals`：按创建日期排列的文章列表与正文；文章右上角提供“比例切分”“张数切分”和“导出 JSON”菜单。比例切分支持固定比例分页，张数切分通过滑动条在 1–18 张内选择，短文章会按可用内容块自动收窄上限；前两项均可选择 PNG、JPG 或 PDF。
- `Capture`：浏览器本地写作、图片导入、自动保存和 JSON 导入导出工具。图片可选择随文插入或在正文后集中为响应式图集；页面顶部只显示标题与说明，正文底部显示自动保存状态、真实修改时间和草稿动作。
- `JewelRoam`：个人信息、经历、公开链接、Playlists 与 Rights。
- `ZaiChang`：指向独立仓库站点的外链入口，不属于本站内容路由。

根路径和未知路径进入 `JewelRoam`。路由集中在 `src/App.tsx`，页面实现位于 `src/pages/`；可复用界面位于 `src/components/`。

## 布局原则

普通页面共用 `.page-shell`，只提供一致的响应式 gutter 和纵向节奏，刻意不设置全局最大宽度。页面内容是否收窄由内容自身决定，避免为了视觉框架增加无必要的容器层级。

导航是脱离文档流的顶部浮层：外层不拦截页面交互，只有玻璃胶囊本身接收指针事件。它默认收起，展开或收起都不推动正文。

导航与普通页面标题共享同一个 `--page-top-space`，当前统一为 `48px`；触发器为 `48px` 圆形控件。按钮栈固定在视口右上角，不随页面滚动；桌面端菜单向左展开，移动端菜单从触发器左侧、与触发器顶部齐平的位置向下展开，菜单文字始终保持横排。左右 gutter 由 `--page-gutter` 统一控制，但不设置全局最大宽度。

主导航和 Journal 的导出菜单共用 `src/components/GlassMenu.tsx`；菜单内容通过 render prop 注入，因此开合状态、玻璃容器、触发器和阶梯动画只维护一份。

详情页和非一级路由由 `src/components/BackButton.tsx` 在右上角提供圆形返回按钮，Journal 的导出菜单会追加到同一按钮栈中，所有按钮纵向对齐；返回按钮固定为按钮栈最下方。应用内导航优先返回上一页，直接打开详情页时回退到对应的一级入口。

`Destinations` 不使用普通页面外框。`.destinations-stage` 占满 `100svh`，地图填满舞台，标题简介位于地图之上，站点导航位于最高层。地图不显示缩放或复位按钮：触控端单指移动、双指缩放，桌面端可拖拽和滚轮缩放；旋转与俯仰手势禁用。地图通过 `ResizeObserver` 响应视口和容器尺寸变化。

## 内容关系

Place 是 Journal 和 Photo 的共同归档键：

```text
Place 1 ── N Journals
Place 1 ── N Photos
Journal N ── N Places
Photo N ── 1 Place
```

一个 Journal 可以属于多个 Place；每张 Photo 仍只属于一个归档地点。Place 默认是面状区域，也可以标记为 `kind: "route"`，使用 `LineString` 表示一段近似旅行线路。正式数据分别位于 `content/places`、`content/journals` 和 `content/photos`，字段协议集中在 `src/lib/content-schema.ts`。

内容校验分为两个边界：浏览器端用共享 Schema 的 `safeParse` 校验导入 JSON 和静态内容，并把错误转换成带文件/字段路径的提示；正式 ArticleDraft 协议和 IndexedDB StoredDraft 协议都只接受当前格式，不迁移旧数据。Node 端的 `npm run content:validate` 读取整个仓库，用同一份 Schema 校验单文件，再由 `src/lib/content-validation.ts` 检查 ID 唯一性、地点层级、GeoJSON 环和 Journal/Photo 引用关系。Node 脚本用 TypeScript AST 读取 MDX 中导出的静态 `frontmatter`，对 PhotoEmbed/PhotoGallery 只接受明确的静态属性，不执行文章代码，也不再维护另一份字段协议。

Place 可以通过可选的 `parentId` 表达包含关系，例如 `Big Almaty Lake → Almaty`。线路型 Place（例如 `Tashkent—Samarkand`）用于照片发生在移动途中、无法合理归到单一城市的场景；它的路线几何是归档和展示用的近似线，不代表精确 GPS 轨迹。Journal 的 `placeIds` 表达文章涉及的地点集合，文章内每张 Photo 的 `placeId` 必须属于这个集合。地图 GeoJSON 会按层级排序，让父区域先绘制、子区域后绘制；区域使用立体面状图层，线路使用独立的高亮线图层。重叠区域的悬停和点击始终优先选择层级更深的地点。校验器会检查父级存在且层级无循环，避免依赖文件名顺序产生歧义。

## 图片与发布边界

Capture 的草稿和 Base64 图片仅保存在当前浏览器 IndexedDB；它不直接写仓库或上传 R2。正式照片以一份清理 EXIF 后的全尺寸 JPEG 进入 `jewelroam-media`，页面只通过 `src/lib/media.ts` 请求 Cloudflare Image Transformations 的缩略图。每张正式照片 metadata 的 `rights.licenseUrl` 固定为 `https://jewelroam.github.io/rights`；`content/inbox/` 是本地素材和中间产物目录，不属于运行时内容源；除非用户明确要求，不应提交或删除其中的素材。

Capture 与 Journal JSON 导出共用 `schemaVersion: 3` 的文章协议，`places` 保存地点 ID 与名称，正式 Journal frontmatter 使用 `placeIds` 数组，并以 `mediaLayout: "inline" | "gallery"` 区分展示方式。对用户和 Agent 来说，一篇文章仍然是一个可导入/导出的 JSON 文件；仓库内部没有引入额外的 sidecar 元数据格式。Journal 的视觉导出先生成统一页面 DOM，再按本次弹窗选择写入 PNG/JPG ZIP 或 PDF；比例切分支持 `1:1`、`2:3`、`3:4`、`9:16`，张数切分通过滑动条选择 1–18 张，并按文章块数量自动收窄上限。连续图片会使用 justified layout 计算 2/3 张一组的几何位置，不裁切图片。视觉导出必须读取图片像素，因此要求 R2 CORS 允许站点来源。

发布顺序固定为：本地确认内容与发行文件，上传并验证 R2 对象，写入正式内容记录，运行校验和构建，最后提交并推送 GitHub。仓库不区分 staging 与 production。
