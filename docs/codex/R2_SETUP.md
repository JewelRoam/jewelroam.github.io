# Cloudflare R2 图片配置

这份说明对应当前项目中的 `src/lib/media.ts` 和 `content/photos/*.json`。R2 存放公开发行图，Cloudflare Image Transformations 按请求生成并缓存缩略图。

## 1. 创建 bucket

在 Cloudflare Dashboard 创建一个 R2 bucket，例如：

```text
jewelroam-media
```

只上传适合网页展示的公开发行图。RAW、完整 EXIF/XMP、编辑工程和高分辨率母版放在私有备份位置，不上传到这个 bucket。

## 2. 绑定图片域名

在 bucket 的 **Settings → Custom Domains** 绑定：

```text
images.zer.dpdns.org
```

该域名必须属于当前 Cloudflare zone，并保持代理状态。不要把 `r2.dev` 作为正式站点的图片域名。

## 3. 启用图片转换

在 `zer.dpdns.org` 对应的 zone 启用 **Image Transformations**。当前已启用，来源限制为该 zone 及其子域。项目会生成如下 URL：

```text
https://images.zer.dpdns.org/cdn-cgi/image/width=640,format=auto,quality=82/photos/2026/coast-window.webp
```

组件会自动提供 640、1280、2048 三个候选宽度，浏览器根据视口和像素密度选择合适版本。转换结果由 Cloudflare 缓存，不需要在 R2 中保存每种尺寸的副本。

### 允许文章导出读取图片

Journal 的 JSON 和分页 PNG 导出需要在浏览器中读取图片。公开图片 bucket 可在 **Settings → CORS Policy** 增加只读规则：

```json
[
  {
    "AllowedOrigins": [
      "https://jewelroam.github.io",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

当前配置已通过实际预检请求验证，返回 `204` 和 `Access-Control-Allow-Origin`。该 bucket 只保存公开发行图，允许跨域 GET 不会赋予上传或修改权限。Cloudflare Image Transform 响应可能不透传 bucket 的 CORS 头，导出器会在变换 URL 被拦截时自动回退到同一资源的原图 URL；如果原图也未配置 CORS，JSON 会保留远程 URL，PNG 导出会明确提示缺少 CORS。

## 4. 配置本地环境

复制 `.env.example` 为 `.env`，填入实际图片域名：

```bash
VITE_MEDIA_BASE_URL=https://images.zer.dpdns.org
```

修改图片时，只需要更新 `content/photos/*.json` 中的 `media.path` 和尺寸。React 组件不应直接硬编码 R2 URL。

## 5. 单一环境与发布循环

项目不区分 staging 和 production，只使用一个 R2 bucket 和一个图片域名。R2 是发布目标，GitHub 仓库仍然是文章、图片 manifest 和代码的来源。

正式照片 metadata 的 `rights.licenseUrl` 统一固定为 `https://jewelroam.github.io/rights`。草稿可以暂时留空，但不得把空值或其他页面地址写入 `content/photos/*.json`。

每次新增或替换图片时按这个顺序操作：

```text
本地整理图片和 metadata
    ↓
本地运行页面和检查构图
    ↓
上传最终发行图到 R2（使用稳定、不可变的路径）
    ↓
检查原图 URL 和 Image Transformations URL
    ↓
把 photo JSON / MDX 和已确认的 R2 路径提交到 GitHub
    ↓
GitHub Actions 校验并部署站点
```

不要在 manifest 已经提交后才上传图片，否则 GitHub Pages 可能先发布一个指向不存在资源的页面。图片上传失败时不要提交该 manifest；图片替换时使用新的文件路径或版本号，不要依赖 CDN 立刻刷新被覆盖的旧对象。

尚未确认发布的图片保留在 `content/inbox/`，通过 Capture 的 Base64 草稿或 inbox 预览检查，不写入正式 manifest。`content/inbox/` 默认是本地素材目录，不应因为正式内容提交而自动加入 Git；当前运行时代码没有 `public/media` 回退；正式 `content/photos/*.json` 只引用已经上传并验证的 R2 对象。

## 6. 发布和权限

### 使用项目 CLI 发布

Wrangler OAuth 登录后，直接从项目根目录发布某篇文章的发行图：

```bash
npx wrangler login
npm run content:publish-r2 -- --dry-run almaty-1
npm run content:publish-r2 -- almaty-1
```

可以一次传入多个 slug。CLI 只读取 `content/inbox/<slug>/release/` 下的 `.webp`、`.jpg` 和 `.jpeg`，将它们上传到固定的 `jewelroam-media/upload/photos/2026/`，并为每个对象检查公开 URL；WebP 还会检查 640px Image Transformations URL。实际发布前先运行 `--dry-run`，确认文件清单无误。

常用覆盖参数：

```bash
npm run content:publish-r2 -- --no-check almaty-1
npm run content:publish-r2 -- --bucket jewelroam-media --prefix upload/photos/2026 almaty-1 almaty-3
```

CLI 不会删除本地素材或 R2 对象，也不会修改正式 metadata；发布后仍需按本文件的顺序运行校验、提交 metadata 并推送 GitHub。

当前代码仓库不保存 Cloudflare 密钥。若后续增加 GitHub Actions 自动上传图片，使用 GitHub Secrets 保存：

```text
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

令牌只授予目标 bucket 的对象读写权限，不要使用账户级全权限 Token。R2 和 Image Transformations 的免费额度、计费规则可能变化，正式启用前应在 Cloudflare Dashboard 核对当前计划。

## 7. 发布检查

上传一张公开发行图后，将它的路径写入一个 photo JSON，并执行：

```bash
npm run content:validate
npm run dev
```

然后在浏览器中检查原图 URL 和 `/cdn-cgi/image/width=640,format=auto/...` 转换 URL，并打开引用该图片的 Journal 或 Photo 页面。若转换 URL 返回 404，优先检查对象路径、自定义域名绑定、DNS 代理状态和 Image Transformations 的来源限制。
