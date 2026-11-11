import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see /Dockerfile).
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Task planning was renamed Plans; old links (including ?job= and ?plan=) keep working.
  async redirects() {
    return [
      { source: "/layouts/task-planning", destination: "/layouts/plans", permanent: true },
      { source: "/layouts/masters", destination: "/layouts/masters/villages", permanent: false },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
