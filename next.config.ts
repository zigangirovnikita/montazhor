import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "1gb"
    }
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: [
          "**/.git/**",
          "**/.next/**",
          "**/.pnpm-store/**",
          "**/.venv/**",
          "**/node_modules/**",
          "**/storage/**"
        ]
      };
    }

    return config;
  }
};

export default nextConfig;
