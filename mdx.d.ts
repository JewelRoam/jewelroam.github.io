declare module "*.mdx" {
  import type { ComponentType } from "react";
  import type { JournalFrontmatter } from "./src/lib/content-schema";

  export const frontmatter: JournalFrontmatter;

  const MDXContent: ComponentType<Record<string, unknown>>;
  export default MDXContent;
}
