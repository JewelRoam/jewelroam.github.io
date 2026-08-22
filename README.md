# JewelRoam

JewelRoam 是一个以旅行、摄影和 Journals 为核心的静态个人网站。核心界面固定为 `Destinations`、`Journals`、`Capture` 和 `JewelRoam`，菜单另保留 `ZaiChang` 外链入口；根路径直接进入 `JewelRoam`。

## 本地开发

```bash
npm install
npm run dev
```

开发服务器端口以 Vite 终端输出为准。页面采用 React Router：普通页面共用一致的响应式 gutter，不设置全局最大宽度；`Destinations` 是独立的全视口地图页。

图片地址通过 `VITE_MEDIA_BASE_URL` 配置，默认使用 `https://images.zer.dpdns.org`。R2 中的公开图片由 Cloudflare Image Transformations 按需生成缩略图并缓存。

R2 的账户、bucket、图片域名和 Image Transformations 开通步骤见 [`docs/codex/R2_SETUP.md`](docs/codex/R2_SETUP.md)。

## 内容

- `content/journals/*.mdx`：Journal 正文和元数据；每篇 Journal 必须绑定一个 `placeId`。
- `content/places/*.json`：目的地名称、坐标和地图几何；一个地点可以关联多篇 Journal 与多张照片。
- `content/photos/*.json`：图片尺寸、替代文本、R2 路径、版权信息和唯一 `placeId`。
- `src/lib/content-schema.ts`：浏览器和 Node 共用的内容协议；文章 Capture/Journal 导出仍然是单个 JSON 文件。
- `src/lib/content-validation.ts`：不依赖运行环境的字段诊断和跨文件引用检查。
- `src/lib/media.ts`：唯一的 Cloudflare 图片 URL 生成入口。

原始 RAW、编辑工程和高分辨率母版不应提交到此仓库或公开 R2 bucket。

图片发布遵循“本地确认 → 上传 R2 → 检查 URL → 提交 manifest → 部署站点”的顺序；不要让 GitHub 先发布一个尚未上传到 R2 的图片路径。

日常写作和图片交接流程见 [`docs/codex/CONTENT_WORKFLOW.md`](docs/codex/CONTENT_WORKFLOW.md)。本地启动后打开 `/editor`，即可直接写文章并把图片拖进正文；确认后再导出 JSON 交给 agent 上传 R2。

Capture 的页面动作按编辑流程分层：顶部只保留页面说明，文章信息集中在标题、摘要、地点和创建日期区域，格式工具固定在编辑区上方，自动保存状态、最近修改时间、清空和 `JSON` 导出位于正文底部。窄屏下图片导入动作会单独换行，避免工具按钮被截断。

当前页面结构、浮层关系和数据边界见 [`docs/codex/CURRENT_ARCHITECTURE.md`](docs/codex/CURRENT_ARCHITECTURE.md)。

## 检查与构建

浏览器只在导入 JSON 或加载静态内容时做当前数据的字段校验；正式文章 JSON 使用严格协议，未知字段会被拒绝。本地 IndexedDB 草稿使用单独的当前存储协议，不迁移旧格式。`content:validate` 是上线前的仓库级检查，会额外检查 ID 唯一性、地点层级、GeoJSON 环和文章地点、图片引用。两边共用同一份 Schema 和诊断格式。

```bash
npm run content:validate
npm run typecheck
npm run build
```
