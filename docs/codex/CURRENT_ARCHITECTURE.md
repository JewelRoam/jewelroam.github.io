# 当前架构与设计约束

## 页面结构

公开导航固定为四项：

- `Destinations`：以 MapLibre 渲染的全视口地点地图；地点悬停抬升，点击进入地点归档。
- `Journals`：按创建日期排列的文章列表与正文。
- `Capture`：浏览器本地写作、图片导入、自动保存和 JSON 导出工具。
- `About`：个人信息、经历、公开链接、Playlists 与 Rights。

根路径和未知路径进入 `About`。路由集中在 `src/App.tsx`，页面实现位于 `src/pages/`；可复用界面位于 `src/components/`。

## 布局原则

普通页面共用 `.page-shell`，只提供一致的响应式 gutter 和纵向节奏，刻意不设置全局最大宽度。页面内容是否收窄由内容自身决定，避免为了视觉框架增加无必要的容器层级。

导航是脱离文档流的顶部浮层：外层不拦截页面交互，只有玻璃胶囊本身接收指针事件。它默认收起，展开或收起都不推动正文。

`Destinations` 不使用普通页面外框。`.destinations-stage` 占满 `100svh`，地图填满舞台，标题简介位于地图之上，站点导航位于最高层。MapLibre 控件在右侧下移，避免与站点导航重叠；地图通过 `ResizeObserver` 响应视口和容器尺寸变化。

## 内容关系

Place 是 Journal 和 Photo 的共同归档键：

```text
Place 1 ── N Journals
Place 1 ── N Photos
Journal N ── 1 Place
Photo N ── 1 Place
```

一个 Journal 只能属于一个 Place，从而避免文章和地图区域的多对多同步。正式数据分别位于 `content/places`、`content/journals` 和 `content/photos`，由 Zod 运行时解析并由 `npm run content:validate` 检查跨文件引用。

## 图片与发布边界

Capture 的草稿和 Base64 图片仅保存在当前浏览器 IndexedDB；它不直接写仓库或上传 R2。正式发行图进入 `jewelroam-media`，页面只通过 `src/lib/media.ts` 生成自定义域名和 Image Transformations URL。

发布顺序固定为：本地确认内容与发行文件，上传并验证 R2 对象，写入正式内容记录，运行校验和构建，最后提交并推送 GitHub。仓库不区分 staging 与 production。
