import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev only: StrictMode double-invokes effects, which DOUBLES every polling timer
  // (notifications, schedule, credit ping…) and was a real contributor to the
  // local "Too many requests" 429. Disabling it halves dev request volume.
  reactStrictMode: false,
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/_landing.html" }],
    };
  },
};

export default nextConfig;
