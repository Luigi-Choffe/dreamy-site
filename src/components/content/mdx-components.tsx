import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { FlowDiagram } from "@/components/diagrams/FlowDiagram";
import { CaseMetric } from "@/components/content/CaseMetric";

/**
 * Componentes disponíveis dentro dos arquivos MDX (cases, insights).
 * Mantidos mínimos: o texto crítico deve permanecer HTML.
 */

function Figure({
  src,
  alt,
  width,
  height,
  caption,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}) {
  return (
    <figure>
      <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1024px) 720px, 100vw" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-brand/40 bg-brand-soft/60 p-5 text-foreground">{children}</div>;
}

export const mdxComponents = {
  FlowDiagram,
  CaseMetric,
  Figure,
  Callout,
  a: (props: ComponentProps<"a">) => (
    <a
      {...props}
      rel={props.href?.startsWith("http") ? "noopener noreferrer" : undefined}
      target={props.href?.startsWith("http") ? "_blank" : undefined}
    />
  ),
};
