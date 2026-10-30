/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bibliotecas de extração da redação rodam só na rota /api/parse-briefing (Node), sem bundle.
  experimental: { serverComponentsExternalPackages: ["mammoth", "pdf-parse"] },
  webpack: (config) => {
    // react-konva tenta resolver o build node do konva (que exige "canvas"); no browser não é necessário.
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
