import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const alt = "Dreamy — Software sob medida e Agentes de IA para empresas";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** OG padrão (Home e páginas sem imagem própria). Gerado no build. */
export default async function Image() {
  return renderOgImage({
    eyebrow: "Software sob medida + IA",
    title: "Tecnologia sob medida para sua empresa ganhar mais e operar melhor.",
    description:
      "Novos produtos digitais, sistemas personalizados e agentes de IA para desafios que softwares prontos não resolvem.",
  });
}
