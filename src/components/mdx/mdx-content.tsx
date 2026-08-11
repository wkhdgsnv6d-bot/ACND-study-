import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import {
  AscendExample,
  Callout,
  Comparison,
  Figure,
  Option,
  SecurityWarning,
  Step,
  Steps,
  VendorNote,
} from "@/components/mdx/blocks";
import { proseComponents } from "@/components/mdx/prose";

/**
 * Renders a lesson, module or term body.
 *
 * Compilation happens on the server at build time — every lesson page is
 * statically generated — so no MDX compiler reaches the browser.
 *
 * `blockJS` is left at its default of true. Lesson bodies are prose and
 * components; there is no reason for content to evaluate expressions, and
 * disallowing it removes a whole category of mistake from a file format that
 * will eventually hold hundreds of thousands of words.
 */

const components = {
  ...proseComponents,
  Callout,
  SecurityWarning,
  VendorNote,
  AscendExample,
  Steps,
  Step,
  Comparison,
  Option,
  Figure,
};

export async function MdxContent({ source }: { source: string }) {
  const { content } = await compileMDX({
    source,
    components,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "wrap",
              properties: { className: "no-underline hover:underline" },
            },
          ],
          [
            rehypePrettyCode,
            {
              // Two themes, both emitted; CSS picks one so code blocks follow
              // the app's theme without a re-render or a flash.
              theme: { dark: "github-dark-dimmed", light: "github-light" },
              keepBackground: false,
              defaultLang: "text",
            },
          ],
        ],
      },
    },
  });

  return <div className="lesson-prose">{content}</div>;
}
