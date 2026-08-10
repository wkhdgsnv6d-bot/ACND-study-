import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Lesson bodies are read from `content/` on disk. Every lesson page is
   * statically generated, so these reads normally happen at build time — but
   * tracing the directory guarantees the files ship with the deployment for any
   * route that renders dynamically.
   */
  outputFileTracingIncludes: {
    "/course/**": ["./content/**/*"],
    "/api/search-index": ["./content/**/*"],
  },

  images: {
    // Project screenshots in the portfolio are user-supplied URLs; keep the
    // allowlist explicit rather than reaching for the deprecated `domains`.
    remotePatterns: [],
  },

  typescript: {
    // Type errors must fail the build. Never set this to true.
    ignoreBuildErrors: false,
  },
  // Next 16 dropped `next lint`; ESLint runs as its own CLI step via
  // `npm run lint` and in CI, not as part of `next build`.
};

export default nextConfig;
