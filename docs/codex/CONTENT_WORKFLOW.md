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

启动本地开发服务器后，按终端显示的端口打开 `/editor`，例如：

```text
http://127.0.0.1:5173/editor
```

编辑器支持标题、摘要、创建日期、段落、撤销/重做、粗体、斜体、小标题、引用、列表，以及同时拖入、粘贴或选择多张图片。地点控件可以搜索已有 Place，也可以直接输入新地点；新地点会以 `needs-place-record` 状态导出，等待 Agent 补全坐标和地图几何后再发布。创建日期 `createdAt` 可以手动修改；修改日期 `updatedAt` 由编辑器在内容真实变化并自动保存时记录，不能手动修改。格式工具栏在编辑时固定在视口顶部，窄屏下图片导入动作独立换行。正文底部显示自动保存状态和最近修改时间，并提供清空草稿与 JSON 导出动作。草稿经过防抖后自动保存在当前浏览器的 IndexedDB 中，图片先以内嵌预览保存，不会自动上传 R2；旧版 `localStorage` 草稿和只有 `savedAt` 的草稿会自动迁移。

点击“导出 JSON”会下载一个 JSON 文件，其中包含 `createdAt` 和系统生成的 `updatedAt`。把这个文件交给 agent，agent 可以据此生成正式的 MDX、图片 manifest 和 R2 发布清单。正式文章 frontmatter 必须保留这两个字段，公开页面显示 `createdAt`，`updatedAt` 用于真实记录最近一次内容修改。

## 你只需要做的事

1. 在 `/editor` 中写文章，把待用图片直接拖进正文。
2. 点击“导出 JSON”，保留下载的 JSON 文件。
3. 在 Codex 中告诉 agent：

   ```text
   处理这份文章草稿 JSON。先生成正式 MDX 和图片 metadata，不要上传 R2。
   ```

批量图片或无法在编辑器中预览的原始文件，仍可以放进 `content/inbox/`，再让 agent 扫描处理。该目录默认作为本地素材保留，不自动提交到 Git；正式内容只写入 `content/journals/`、`content/places/` 和 `content/photos/`。

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
  → 在 content/inbox 中生成待确认的 metadata、Place、Photo 和 MDX 草案
  → 等待用户确认文字、地点、图片、版权和公开范围
  → 上传最终发行图到 R2
  → 检查原图和转换 URL
  → 写入正式 content/places、content/photos 和 content/journals
  → 运行内容校验和生产构建
  → 提交并推送 GitHub
  → 删除或归档 inbox 临时文件
```

正式 manifest 可以在本地准备和检查，但必须等对应 R2 对象上传并验证后再提交。这样可以避免 GitHub Pages 先上线一个指向不存在 R2 对象的页面。

## 图片引用约定

编辑器导出的草稿使用内嵌图片数据，不写 R2 URL。正式 MDX 阶段由 agent 将图片转换成项目组件引用：

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
回合 2：确认后在 inbox 准备 MDX、manifest 和发行文件，并运行本地检查
回合 3：明确授权后上传 R2，验证 URL，写入正式内容，再提交 GitHub
```

这样对话记录就是一次可追溯的发布记录；如果中途发现图片或文字有问题，可以停在任一回合，不会留下半成品线上资源。
