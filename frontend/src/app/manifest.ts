import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kaamlee",
    short_name: "Kaamlee",
    description: "Job Applying is a Job. Visualize your future commute with our map based jobs.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2f3f5",
    theme_color: "#f2f3f5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
