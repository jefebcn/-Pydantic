import type { MetadataRoute } from "next";

/** Permette di aggiungere il sito alla schermata Home del telefono. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Seconda Mano Hunter",
    short_name: "SM Hunter",
    description: "Gli affari su Amazon Seconda Mano confrontati col prezzo del nuovo.",
    start_url: "/",
    display: "standalone",
    background_color: "#e8f0fa",
    theme_color: "#1c1c20",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
