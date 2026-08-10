import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign out.
 *
 * POST only. A GET sign-out endpoint can be triggered by a prefetch, a link
 * preview or an image tag, which produces the memorable bug of being logged out
 * by hovering over your own navigation.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), {
    status: 303,
  });
}
