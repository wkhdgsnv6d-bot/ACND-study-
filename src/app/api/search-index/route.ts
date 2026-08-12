import { NextResponse } from "next/server";

import { buildSearchIndex } from "@/lib/search";

/**
 * The search index, fetched once by the command palette on first open.
 *
 * Contains only content — lessons, labs, tools, templates. No user data, which
 * is why it is safe to cache. Notes, prospects and projects are searched
 * through their own authenticated surfaces.
 */
export const dynamic = "force-static";

export async function GET() {
  const documents = await buildSearchIndex();
  return NextResponse.json(documents, {
    headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
