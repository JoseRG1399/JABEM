/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: '../app',      // Exporta al app/ en la RAÍZ
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  webpack: (config) => config,
};

module.exports = nextConfig;
