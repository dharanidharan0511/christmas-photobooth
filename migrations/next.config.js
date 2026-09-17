/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output as a standard Node.js server (not standalone by default; change to
  // "standalone" when containerising with the provided Dockerfile).
  // output: "standalone",

  // If the app is deployed at a sub-path (e.g. /tp-web/), set basePath here
  // and ensure the same value is exported as BASE_URL for SSO redirect_uri.
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",

  // Redirect root to dashboard so bookmarks to "/" still work.
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },

  // Security headers are added in checkpoint_005 (task_023). They are
  // intentionally absent here so the foundation build passes first.

  // Disable the "X-Powered-By: Next.js" header — minor information leak.
  poweredByHeader: false,

  // React strict mode enabled for early double-invoke detection in dev.
  reactStrictMode: true,
};

module.exports = nextConfig;
