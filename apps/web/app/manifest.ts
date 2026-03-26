import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KinetiCare Health AI",
    short_name: "KinetiCare",
    description: "Zero-UI Clinical Diagnostics & Heart Rate Monitoring",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#14b8a6",
    icons: [
      {
        src: "/icon.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
    ],
  };
}
