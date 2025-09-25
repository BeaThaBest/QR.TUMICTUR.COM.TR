// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbopack: {
      // projenin kökü bu klasör
      root: ".",
    },
  },
};

export default nextConfig;