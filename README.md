# JewelRoam

JewelRoam 是一个以旅行、摄影和长文为主题的静态个人档案站。

## 本地开发

```bash
npm install
npm run dev
```

图片地址通过 `VITE_MEDIA_BASE_URL` 配置，默认使用 `https://images.zer.dpdns.org`。R2 中的公开图片由 Cloudflare Image Transformations 按需生成缩略图并缓存。

R2 的账户、bucket、图片域名和 Image Transformations 开通步骤见 [`docs/codex/R2_SETUP.md`](docs/codex/R2_SETUP.md)。

## 内容

- `content/journals/*.mdx`：Journal 正文和元数据；每篇 Journal 必须绑定一个 `placeId`。
- `content/places/*.json`：目的地名称、坐标和地图几何；一个地点可以关联多篇 Journal 与多张照片。
- `content/photos/*.json`：图片尺寸、替代文本、R2 路径、版权信息和唯一 `placeId`。
- `src/lib/media.ts`：唯一的 Cloudflare 图片 URL 生成入口。

原始 RAW、编辑工程和高分辨率母版不应提交到此仓库或公开 R2 bucket。

图片发布遵循“本地确认 → 上传 R2 → 检查 URL → 提交 manifest → 部署站点”的顺序；不要让 GitHub 先发布一个尚未上传到 R2 的图片路径。

日常写作和图片交接流程见 [`docs/codex/CONTENT_WORKFLOW.md`](docs/codex/CONTENT_WORKFLOW.md)。本地启动后打开 `/editor`，即可直接写文章并把图片拖进正文；确认后再导出草稿交给 agent 上传 R2。

## 检查与构建

```bash
npm run content:validate
npm run typecheck
npm run build
```
