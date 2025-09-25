// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbopack: {
      // point Turbopack at the repository root directory
      root: ".",
    },
  },
};

export default nextConfig;
