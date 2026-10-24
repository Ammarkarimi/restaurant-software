import type { MetadataRoute } from "next";

/** Lets restaurants "Install app" / "Add to home screen" on the billing PC, tablets and captains' phones. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Restaurant Manager",
    short_name: "Restaurant",
    description: "Billing, tables, menu, kitchen tickets and reports for your restaurant",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ea580c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
