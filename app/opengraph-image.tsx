import { ImageResponse } from "next/og";

export const alt = "Seconda Mano Hunter: gli affari su Amazon Seconda Mano";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Anteprima del sito quando il link viene condiviso. */
export default function OpenGraphImage() {
  const tiles = [
    { bg: "#dceafb", label: "Seconda Mano", big: "Il prezzo" },
    { bg: "#e3dcf6", label: "Prezzo del nuovo", big: "Il confronto" },
    { bg: "#d6efdc", label: "Voto Hunter", big: "0-100" },
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#141418", color: "#fff", padding: 64 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: "#f5a623" }}>SECONDA MANO HUNTER</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginTop: 18, maxWidth: 1000 }}>Gli affari che valgono davvero, trovati per te.</div>
        <div style={{ display: "flex", marginTop: 48, gap: 20 }}>
          {tiles.map((t) => (
            <div key={t.label} style={{ display: "flex", flexDirection: "column", flex: 1, background: t.bg, color: "#17171c", borderRadius: 28, padding: 28 }}>
              <div style={{ fontSize: 24, color: "#5c5f6b" }}>{t.label}</div>
              <div style={{ fontSize: 40, fontWeight: 800, marginTop: 10 }}>{t.big}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
