import { HubDiagram } from "@/components/diagrams/HubDiagram";

/**
 * SystemDiagram (PRD §62): sistema/agente no centro conectado às fontes e ferramentas
 * da empresa (CRM, ERP, WhatsApp, e-mail, banco de dados, documentos, APIs).
 */
export function SystemDiagram({
  title,
  center,
  centerDetail,
  nodes,
  className,
}: {
  title: string;
  center: string;
  centerDetail?: string;
  nodes: string[];
  className?: string;
}) {
  return <HubDiagram title={title} center={center} centerDetail={centerDetail} nodes={nodes} className={className} />;
}
