import { redirect } from "next/navigation";

/**
 * The platform has no marketing surface — it is a private tool. Requests to the
 * root go straight to the dashboard, and `proxy.ts` diverts to `/login` or
 * `/setup` when there is no session or no database.
 */
/** Per-request, so the CSP nonce from `proxy.ts` reaches the script tags. */
export const dynamic = "force-dynamic";

export default function RootPage() {
  redirect("/dashboard");
}
