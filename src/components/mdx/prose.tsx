import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Typography for lesson bodies.
 *
 * Written by hand rather than pulled from a prose plugin, because lesson
 * reading is the single most-used surface in the platform and its measure,
 * rhythm and heading hierarchy are worth controlling directly. Sizes are tuned
 * for long-form reading at a ~68 character measure.
 */

export const proseComponents = {
  h1: (props: ComponentProps<"h1">) => (
    <h1
      {...props}
      className="mt-10 mb-4 scroll-mt-24 text-2xl font-semibold tracking-tight text-balance first:mt-0"
    />
  ),
  h2: (props: ComponentProps<"h2">) => (
    <h2
      {...props}
      className="mt-12 mb-4 scroll-mt-24 border-b border-border pb-2 text-xl font-semibold tracking-tight text-balance first:mt-0"
    />
  ),
  h3: (props: ComponentProps<"h3">) => (
    <h3
      {...props}
      className="mt-8 mb-3 scroll-mt-24 text-base font-semibold tracking-tight text-balance"
    />
  ),
  h4: (props: ComponentProps<"h4">) => (
    <h4 {...props} className="mt-6 mb-2 scroll-mt-24 text-sm font-semibold" />
  ),

  p: (props: ComponentProps<"p">) => (
    <p {...props} className="my-4 leading-7 text-muted-foreground text-pretty" />
  ),

  ul: (props: ComponentProps<"ul">) => (
    <ul {...props} className="my-4 list-disc space-y-2 pl-5 text-muted-foreground" />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol {...props} className="my-4 list-decimal space-y-2 pl-5 text-muted-foreground" />
  ),
  li: (props: ComponentProps<"li">) => (
    <li {...props} className="leading-7 marker:text-subtle-foreground" />
  ),

  strong: (props: ComponentProps<"strong">) => (
    <strong {...props} className="font-semibold text-foreground" />
  ),
  em: (props: ComponentProps<"em">) => <em {...props} className="italic" />,

  a: ({ href = "", className, ...props }: ComponentProps<"a">) => {
    // Heading autolinks wrap the heading text and point at their own id. They
    // must inherit the heading's styling, not look like a link in the prose.
    if (href.startsWith("#")) {
      return (
        <a
          {...props}
          href={href}
          className={cn("text-inherit no-underline hover:underline", className)}
        />
      );
    }

    const external = /^https?:\/\//.test(href);
    if (external) {
      return (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline underline-offset-4 hover:no-underline"
        />
      );
    }
    return (
      <Link
        {...props}
        href={href}
        className="text-primary underline underline-offset-4 hover:no-underline"
      />
    );
  },

  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      {...props}
      className="my-6 border-l-2 border-border-strong pl-4 text-muted-foreground italic"
    />
  ),

  hr: () => <hr className="my-10 border-border" />,

  /** Inline code. Fenced blocks are handled by `pre` below. */
  code: ({ className, ...props }: ComponentProps<"code">) => {
    const isBlock = className?.includes("language-") || "data-language" in props;
    if (isBlock) return <code {...props} className={className} />;
    return (
      <code
        {...props}
        className={cn(
          "rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-foreground",
          className,
        )}
      />
    );
  },

  pre: ({ className, ...props }: ComponentProps<"pre">) => (
    <pre
      {...props}
      // Fenced code scrolls inside its own container rather than widening the
      // page — the mistake that breaks a reading layout on a phone.
      className={cn(
        "my-6 overflow-x-auto rounded-xl border border-border bg-surface-1 p-4 font-mono text-sm leading-6",
        className,
      )}
    />
  ),

  table: (props: ComponentProps<"table">) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-border">
      <table {...props} className="w-full min-w-[32rem] text-sm" />
    </div>
  ),
  thead: (props: ComponentProps<"thead">) => (
    <thead {...props} className="border-b border-border bg-surface-2 text-left" />
  ),
  th: (props: ComponentProps<"th">) => (
    <th {...props} className="px-3 py-2 font-medium" />
  ),
  td: (props: ComponentProps<"td">) => (
    <td {...props} className="border-b border-border px-3 py-2 text-muted-foreground" />
  ),
};
