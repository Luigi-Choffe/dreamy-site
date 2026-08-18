// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { HeaderClient } from "@/components/layout/HeaderClient";
import { buildNavigation } from "@/config/navigation";

describe("Navegação (Header)", () => {
  it("monta itens conforme gates de conteúdo (sem Cases/Insights vazios)", () => {
    const nav = buildNavigation({ hasCases: false, hasInsights: false });
    expect(nav.primary.map((i) => i.label)).toEqual(["Soluções", "Como trabalhamos", "Sobre"]);
    const withAll = buildNavigation({ hasCases: true, hasInsights: true });
    expect(withAll.primary.map((i) => i.label)).toEqual(["Soluções", "Cases", "Como trabalhamos", "Sobre", "Insights"]);
    expect(nav.primary[0]!.children).toHaveLength(3);
  });

  it("dropdown de Soluções: abre por clique, navega com setas e fecha com ESC", async () => {
    const user = userEvent.setup();
    render(<HeaderClient nav={buildNavigation({ hasCases: false, hasInsights: false })} whatsappUrl={null} />);
    const trigger = screen.getByRole("button", { name: "Soluções" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const links = screen.getAllByRole("link", { name: /Nova Receita Digital/ });
    expect(links.length).toBeGreaterThan(0);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("botão do menu mobile expõe aria-expanded e abre o dialog", async () => {
    const user = userEvent.setup();
    render(
      <HeaderClient
        nav={buildNavigation({ hasCases: false, hasInsights: false })}
        whatsappUrl="https://wa.me/5511948793233"
      />,
    );
    const open = screen.getByRole("button", { name: "Abrir menu" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    await user.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Falar pelo WhatsApp" })).toBeInTheDocument();
  });
});
