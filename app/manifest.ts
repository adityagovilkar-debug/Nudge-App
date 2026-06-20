import type { MetadataRoute } from "next";
import { APP_NAME, APP_DESCRIPTION, BRAND_COLOR } from "@/lib/brand";

// PWA manifest — makes Nudge installable to the phone home screen and the
// desktop. Served at /manifest.webmanifest automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Errands & Reminders`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: BRAND_COLOR,
    orientation: "portrait-primary",
    categories: ["productivity", "lifestyle", "utilities"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
