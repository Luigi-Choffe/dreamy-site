import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

interface OgImageInput {
  eyebrow?: string;
  title: string;
  description?: string;
}

async function loadFonts() {
  const dir = path.join(process.cwd(), "src", "assets", "fonts");
  const [display, sans, logo] = await Promise.all([
    readFile(path.join(dir, "Urbanist-Bold.woff")),
    readFile(path.join(dir, "InstrumentSans-Medium.woff")),
    readFile(path.join(process.cwd(), "public", "brand", "dreamy-logo-dark-bg.png")),
  ]);
  return { display, sans, logoDataUrl: `data:image/png;base64,${logo.toString("base64")}` };
}

/**
 * Gerador único de imagens Open Graph (ADR-012): fundo quase preto, verde Dreamy,
 * logo oficial e título da página. Usado pelos `opengraph-image.tsx` de cada rota.
 */
export async function renderOgImage({ eyebrow, title, description }: OgImageInput) {
  const { display, sans, logoDataUrl } = await loadFonts();
  const titleSize = title.length > 70 ? 54 : title.length > 48 ? 62 : 72;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#0b0b0c",
        color: "#f7f8f8",
        fontFamily: "Instrument Sans",
        position: "relative",
      }}
    >
      {/* brilho verde discreto (Satori: sem gradientes radiais para transparente) */}
      <div
        style={{
          position: "absolute",
          right: -220,
          top: -220,
          width: 620,
          height: 620,
          borderRadius: 9999,
          background: "rgba(70,235,126,0.06)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -120,
          width: 420,
          height: 420,
          borderRadius: 9999,
          background: "rgba(70,235,126,0.07)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -40,
          top: -40,
          width: 260,
          height: 260,
          borderRadius: 9999,
          background: "rgba(70,235,126,0.08)",
          display: "flex",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUrl} width={232} height={65} alt="" style={{ objectFit: "contain" }} />
        {eyebrow ? (
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#46eb7e",
              fontWeight: 500,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1000 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Urbanist",
            fontSize: titleSize,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            fontWeight: 700,
            color: "#f7f8f8",
          }}
        >
          {title}
        </div>
        {description ? (
          <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, color: "#a7abaf", maxWidth: 900 }}>
            {description}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 22,
          color: "#858a8f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 12, height: 12, borderRadius: 9999, background: "#46eb7e" }} />
          Software sob medida + Inteligência Artificial
        </div>
        <div style={{ display: "flex" }}>www.dreamy.app.br</div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Urbanist", data: display, weight: 700, style: "normal" },
        { name: "Instrument Sans", data: sans, weight: 500, style: "normal" },
      ],
    },
  );
}
