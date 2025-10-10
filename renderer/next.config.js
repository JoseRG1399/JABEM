/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only export static files for production build, not for dev server (API routes need server mode)
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  distDir: '../app',      // Exporta al app/ en la RAÍZ
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  webpack: (config) => config,
};

module.exports = nextConfig;
