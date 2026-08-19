declare module "*.mdx" {
  import type { ComponentType } from "react";

  export const frontmatter: {
    slug: string;
    title: string;
    description: string;
    publishedAt: string;
    tags: string[];
    coverPhotoId?: string;
  };

  const MDXContent: ComponentType<Record<string, unknown>>;
  export default MDXContent;
}
