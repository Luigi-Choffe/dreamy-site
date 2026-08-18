# Fontes locais (somente para geração de imagens Open Graph)

- `Urbanist-Bold.woff` — Urbanist (Corey Hu), SIL Open Font License 1.1 — https://fonts.google.com/specimen/Urbanist
- `InstrumentSans-Medium.woff` — Instrument Sans (Rodrigo Fuenzalida, Jordan Egstad), SIL Open Font License 1.1 — https://fonts.google.com/specimen/Instrument+Sans

As fontes do site em si são servidas por `next/font/google` (self-hosted no build). Estes arquivos existem apenas
porque `ImageResponse` (Satori) precisa de buffers de fonte em tempo de build para os `opengraph-image.tsx`.
