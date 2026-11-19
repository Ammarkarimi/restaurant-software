import type { MetadataRoute } from "next";

/** Lets restaurants "Install app" / "Add to home screen" on the billing PC, tablets and captains' phones. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Billspoon",
    short_name: "Billspoon",
    description: "Restaurant billing, tables, kitchen tickets, GST, stock and reports",
    // Sign-in opens the Tables screen when already signed in, and skips the landing page.
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#0E3B2A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
