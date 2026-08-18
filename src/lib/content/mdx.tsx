import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/content/mdx-components";

/** Compila o corpo MDX (sem frontmatter — já extraído com gray-matter) em React (RSC). */
export async function renderMdx(source: string) {
  const { content } = await compileMDX({
    source,
    options: { parseFrontmatter: false, mdxOptions: { remarkPlugins: [remarkGfm] } },
    components: mdxComponents,
  });
  return content;
}
