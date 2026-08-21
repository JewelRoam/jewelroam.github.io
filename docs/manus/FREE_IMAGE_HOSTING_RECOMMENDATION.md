# JewelRoam 免费图片托管建议

**作者：Manus AI**
**日期：2026-08-19**

> **当前实现注记（2026-08-22）**：本文保留早期候选方案比较。项目已经确认使用 Cloudflare R2，bucket 为 `jewelroam-media`，公开域名为 `https://images.zer.dpdns.org`；当前操作步骤以 `docs/codex/R2_SETUP.md` 和 `docs/codex/CONTENT_WORKFLOW.md` 为准。

## 结论

如果“免费”指**不绑定支付方式、不另开云服务账户、完全留在 GitHub 生态**，建议把经过导出的公开图片放到**GitHub Releases**，而不是放进代码仓库或 Git LFS。GitHub 每个 Release 最多可包含 1,000 个资源，每个文件小于 2 GiB，且官方说明未对 Release 总资源大小或下载带宽设上限；这适合个人作品站按年份或季度发布一批可公开浏览的衍生图。[1]

如果可以接受注册一个带免费额度的存储服务，建议将 **Cloudflare R2** 作为长期主方案。它的免费额度为每月 10 GB-month 标准存储、100 万次写/列操作、1,000 万次读操作，且从 R2 直接对互联网输出不收流量费。[2] 对图片很多、访问量不确定的个人网站而言，这比将图片塞进 GitHub Pages 更容易长期维护；但 R2 开通需要订阅/结账流程，超出额度有可能产生费用，因此它不是“绝对零账单风险”的方案。[3]

> **推荐取舍：**现在若坚持完全免费，先使用 **GitHub Releases + 内容清单（manifest）**；前端代码从一开始就与图片提供商解耦。将来图片超过几十个系列、需要更稳定的缓存和自定义图片域名时，只需把同一份 manifest 中的 URL 改为 Cloudflare R2 地址，而不需要重写页面或文章。

## 候选方案对比

| 方案 | 免费资源与关键限制 | 对 JewelRoam 的适配度 | 最终判断 |
| --- | --- | --- | --- |
| **GitHub Releases** | 单个 Release 最多 1,000 个资源；每个资源小于 2 GiB；官方说明未限制 Release 总大小或带宽。[1] | 不新增供应商账户，URL 可直接用于静态站；但没有图片自动裁切、多尺寸转换或自定义 CDN 域名。 | **零成本首选**。只上传衍生图，按批次发布。 |
| **Cloudflare R2** | 10 GB-month 存储、100 万次 Class A、1,000 万次 Class B 操作/月免费；直接外网流量免费。[2] | 容量和流量适合公开图集；可使用自定义域名并接入缓存。 | **长期技术首选**，但需要接受订阅/账单设置。 |
| **Cloudinary Free** | 永久免费、无需信用卡、每月 25 credits；提供上传、变换与 CDN 分发。[4] | 自动生成 WebP/AVIF、多尺寸裁切很方便，但每月信用额度让长期容量与访问预算不够直观。 | 适合快速验证或小型图集，不作为唯一母库。 |
| **Supabase Storage Free** | 1 GB 文件存储、5 GB 出站流量、5 GB 缓存流量；免费项目闲置一周后暂停。[5] | 带数据库和登录时才有额外价值；站点低访问期间暂停会影响公开图片可靠性。 | 不推荐作为纯公开图床。 |
| **GitHub Pages 目录内图片** | 源仓库与已发布站点均建议不超过 1 GB，且站点每月有 100 GB 软带宽上限。[6] | 小规模图片可以使用，但代码仓库会越来越臃肿、每次部署上传变慢。 | 仅用于 logo、favicon 和极少数不可替代的小资源。 |
| **Git LFS** | GitHub Free 每月含 10 GiB 存储与 10 GiB 下载流量，但 GitHub Pages 不支持 Git LFS。[7] | 与目标的 GitHub Pages 发布方式不兼容。 | **明确排除**。 |

## 零成本落地方案：GitHub Releases 作为发行图库

建立一个单独的公开仓库，例如 `JewelRoam/jewelroam-media`，专门存放 Release 资产；不要将它与 `jewelroam.github.io` 的前端代码混合。原始 RAW、高分辨率 JPG 和编辑工程仍保留在私有备份位置，不应作为 Release 资产或公开网页资源。

每张作品只生成两种用于网站的版本：列表/移动端使用 640px WebP，阅读与桌面端使用 1600px WebP 或 JPEG。这样既能为不同屏幕提供合理画质，也可显著减少 Release 文件数；优先避免为每张图生成多个格式和过多尺寸，以免运营复杂度过高。

| 发布层 | 文件举例 | 是否放入 Git | 是否公开 | 说明 |
| --- | --- | --- | --- | --- |
| 私有母库 | `2026-coast-window.RAW`、原始 EXIF/XMP、编辑工程 | 否 | 否 | 证据、备份与未来再导出来源。 |
| Release 发行图库 | `2026-coast-window-640.webp`、`2026-coast-window-1600.webp` | 否，仅作为 Release asset | 是 | 网页唯一引用的图片衍生版本。 |
| 站点代码仓库 | `content/photos/*.yaml` 与 `media-manifest.json` | 是 | 是 | 保存图片描述、alt、尺寸、权利字段和 Release URL。 |

### Release 命名与分批规则

将 Release 视为不变的图片发行批次，而不是临时上传区。推荐使用 `photos-YYYY-qN` 或 `photos-YYYY-series-name` 的 Tag，每个 Release 控制在约 800 个资源以内，为将来的封面、JSON 清单或更正资源保留余量。每张图两种尺寸时，一个 Release 大致可容纳约 400 张图。

```text
jewelroam-media
└── Releases
    ├── photos-2026-q1
    │   ├── coast-window-640.webp
    │   ├── coast-window-1600.webp
    │   └── ...
    └── photos-2026-q2
        └── ...
```

在站点仓库维护一个 provider-agnostic 的清单，让 React 组件只认识 `src` 和 `srcSet`，不认识 GitHub、R2 或 Cloudinary：

```yaml
# content/photos/2026-coast-window.yaml
id: 2026-coast-window
alt: 清晨列车车窗外的雾岛与平静海面
width: 6048
height: 4032
media:
  src: https://github.com/JewelRoam/jewelroam-media/releases/download/photos-2026-q1/coast-window-1600.webp
  srcSet:
    - width: 640
      url: https://github.com/JewelRoam/jewelroam-media/releases/download/photos-2026-q1/coast-window-640.webp
    - width: 1600
      url: https://github.com/JewelRoam/jewelroam-media/releases/download/photos-2026-q1/coast-window-1600.webp
rights:
  notice: "© 2026 JewelRoam. All rights reserved."
  licenseUrl: https://jewelroam.github.io/jewelroam#rights
```

React 的 `ResponsiveImage` 只渲染清单提供的地址、尺寸与 `alt`；文章和图集使用图片 `id` 引用。这样从 GitHub Releases 改用 R2 时，只改变 `media` 数据或生成清单的脚本，文章、组件、链接结构和版权字段均无需改动。

## Cloudflare R2 的升级阈值

以下任一情况出现时，应从 Releases 转向 R2：图片衍生图累计约 5 GB 以上；一个季度新增超过约 300 张图片；需要 `images.jewelroam.com` 这样的稳定图片域名；需要缓存规则、基础反爬或更可控的资源迁移；或者 Release 资源命名开始难以追踪。R2 的公开桶默认不公开；生产访问应绑定自己的域名以启用缓存和访问管理。Cloudflare 明确将 `r2.dev` 描述为非生产开发地址并对其限流，不应将它作为正式图片 URL。[8]

```text
https://images.jewelroam.com/2026/q1/coast-window-1600.webp
```

这个域名结构应在发布脚本中固定，不在 MDX 正文中硬编码。以后替换存储服务时只需让新服务继续提供相同的 URL 或更新 manifest，不会破坏文章永久链接。

## 从第一天开始应执行的规则

不要把原始图片或超过 1600/2048px 的公开发行图直接提交到 `jewelroam.github.io`。GitHub 建议普通仓库保持在 1 GB 以下，超过 100 MiB 的单个文件将被阻止；对于图片密集项目，代码仓库必须只保存文本内容和图片清单。[9]

网页中首屏图片使用高优先级加载，其余画廊图片使用原生 `loading="lazy"` 并声明宽高。浏览器可根据 `srcset` 和 `sizes` 选择合适尺寸，减少移动端下载量；为图片声明宽高还能避免加载时页面跳动。[10]

发布前在每张公开图片写入 IPTC Creator、Copyright Notice、Credit Line 与 Web Statement of Rights。网站的单图页应由该图片记录生成 JSON-LD `ImageObject`，包含 `creator`、`copyrightNotice`、`license` 和 `acquireLicensePage`；这既让人类读者看到权利归属，也向支持该信息的搜索服务提供机器可读许可信息。[11]

## References

[1]: [GitHub Docs — About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
[2]: [Cloudflare R2 Docs — Pricing](https://developers.cloudflare.com/r2/pricing/)
[3]: [Cloudflare R2 Docs — Get started](https://developers.cloudflare.com/r2/get-started/)
[4]: [Cloudinary — Pricing and Plans](https://cloudinary.com/pricing)
[5]: [Supabase — Pricing](https://supabase.com/pricing)
[6]: [GitHub Docs — GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
[7]: [GitHub Docs — About Git Large File Storage](https://docs.github.com/repositories/working-with-files/managing-large-files/about-git-large-file-storage)
[8]: [Cloudflare R2 Docs — Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
[9]: [GitHub Docs — About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
[10]: [web.dev — Responsive images](https://web.dev/learn/design/responsive-images)
[11]: [Google Search Central — Image metadata in Google Images](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata)
