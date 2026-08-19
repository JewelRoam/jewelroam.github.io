# 内容与图片协作流程

项目提供一个本地在线编辑器。你可以直接在浏览器里写文章，把图片拖进正文；R2 上传仍然是确认文章之后的单独发布动作。你不需要在文章里手动拼 Cloudflare URL，也不需要先去控制台创建对象。

## 项目流程 Skills

项目专属的可复用流程放在仓库内的 `.agents/skills/`，不依赖本机全局 skill：

- `jewelroam-article-metadata`：根据文章正文和图片素材起草摘要、标题、alt、拍摄日期、地点、系列与版权 metadata；不擅自补充事实或法律授权。
- `jewelroam-image-pipeline`：解包编辑器导出的 JSON、生成图片 manifest 和 MDX 预览、校验尺寸与引用；R2 上传始终需要单独的明确确认。

图片草稿可用项目脚本处理：

```bash
node .agents/skills/jewelroam-image-pipeline/scripts/stage_article_draft.mjs \
  /absolute/path/article-draft.json \
  --output content/inbox/article-slug \
  --slug article-slug
```

## 在线编辑器

启动本地开发服务器后打开：

```text
http://127.0.0.1:5174/editor
```

编辑器支持标题、摘要、创建日期、段落、粗体、斜体、小标题、引用、列表，以及同时拖入、粘贴或选择多张图片。创建日期 `createdAt` 可以手动修改；修改日期 `updatedAt` 由编辑器在内容真实变化并自动保存时记录，不能手动修改。格式工具栏在编辑时固定在视口顶部。草稿经过防抖后自动保存在当前浏览器的 IndexedDB 中，图片先以内嵌预览保存，不会自动上传 R2；旧版 `localStorage` 草稿和只有 `savedAt` 的草稿会自动迁移。

点击“导出草稿”会下载一个 JSON 文件，其中包含 `createdAt` 和系统生成的 `updatedAt`。把这个文件交给 agent，agent 可以据此生成正式的 MDX、图片 manifest 和 R2 发布清单。正式文章 frontmatter 必须保留这两个字段，公开页面显示 `createdAt`，`updatedAt` 用于真实记录最近一次内容修改。

## 你只需要做的事

1. 在 `/editor` 中写文章，把待用图片直接拖进正文。
2. 点击“导出草稿”，保留下载的 JSON 文件。
3. 在 Codex 中告诉 agent：

   ```text
   处理这份文章草稿 JSON。先生成正式 MDX 和图片 metadata，不要上传 R2。
   ```

批量图片或无法在编辑器中预览的原始文件，仍可以放进 `content/inbox/`，再让 agent 扫描处理。

4. agent 给出图片名称、尺寸、alt、拍摄日期、地点、版权字段和文章引用的变更预览；同时确认 Journal 与每张图片绑定的唯一 `placeId`。
5. 你确认内容无误后，再说：

   ```text
   元数据确认，上传这些图片到 R2，并完成文章引用。
   ```

## agent 的处理顺序

agent 应该按以下顺序工作：

```text
扫描 inbox
  → 读取图片尺寸和格式
  → 询问或推断待确认的标题、alt、日期、地点、版权
  → 生成 content/places/*.json（地点记录）
  → 生成 content/photos/*.json（每张图片绑定一个 placeId）
  → 生成 content/journals/*.mdx（每篇 Journal 绑定一个 placeId）
  → 在 Journal MDX 中接入图片引用
  → 运行内容校验和本地构建
  → 等待用户明确确认
  → 上传最终发行图到 R2
  → 检查原图和转换 URL
  → 删除或归档 inbox 临时文件
```

上传前不要把图片 JSON 当作已发布内容提交。这样可以避免 GitHub Pages 先上线一个指向不存在 R2 对象的页面。

## 图片引用约定

编辑器导出的草稿使用内嵌图片数据，不写 R2 URL。正式 MDX 阶段由 agent 将图片转换成项目组件引用：

```md
发布阶段由 agent 确保 `content/photos/*.json` 中的 `id`、唯一 `placeId`、尺寸、替代文本、R2 路径和版权字段完整；每篇 Journal 的 frontmatter 也必须包含唯一 `placeId`。组件会统一生成：

```mdx
import { PhotoEmbed } from "../../src/components/PhotoEmbed";

<PhotoEmbed id="2026-coast-window" caption="海岸线旁的车窗" />
```

```text
https://images.zer.dpdns.org/cdn-cgi/image/width=640,format=auto,quality=82/...
```

## 哪些信息必须由你确认

- 图片是否允许公开发布；
- 图片标题和替代文本；
- 拍摄日期与地点；
- 是否需要人物隐私处理；
- 版权声明和是否允许转载；
- 是否确认上传到公开 R2。

尺寸、文件格式、文件名规范、manifest 格式和 URL 生成可以交给 agent；版权和公开授权不能由 agent 擅自决定。

## 推荐的 Codex 对话节奏

每次处理一组图片时，使用三个短回合：

```text
回合 1：扫描并提出 metadata 草案，不改线上资源
回合 2：确认后修改 MDX、生成 manifest，并运行本地检查
回合 3：明确授权后上传 R2，验证 URL，再整理 inbox
```

这样对话记录就是一次可追溯的发布记录；如果中途发现图片或文字有问题，可以停在任一回合，不会留下半成品线上资源。
