import type { ReactNode } from "react";

/**
 * Rendered per request so the CSP nonce set in `proxy.ts` reaches the script
 * tags. A prerendered page is built before any request exists, so it carries no
 * nonce and `strict-dynamic` would block its own bundle. These pages are three
 * forms and a message; there is nothing to gain by caching them.
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-8 text-primary">
            <rect x="3" y="14" width="4.5" height="7" rx="1.25" fill="currentColor" opacity="0.45" />
            <rect x="9.75" y="9" width="4.5" height="12" rx="1.25" fill="currentColor" opacity="0.72" />
            <rect x="16.5" y="3" width="4.5" height="18" rx="1.25" fill="currentColor" />
          </svg>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Ascend Business Mastery
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}
