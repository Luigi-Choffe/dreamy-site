// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Accordion } from "@/components/ui/Accordion";

const items = [
  { title: "Pergunta 1", content: <p>Resposta 1</p> },
  { title: "Pergunta 2", content: <p>Resposta 2</p> },
];

describe("<Accordion />", () => {
  it("abre/fecha por clique e teclado com aria-expanded/aria-controls corretos", async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} />);
    const btn1 = screen.getByRole("button", { name: "Pergunta 1" });
    const btn2 = screen.getByRole("button", { name: "Pergunta 2" });
    expect(btn1).toHaveAttribute("aria-expanded", "false");
    const panelId = btn1.getAttribute("aria-controls")!;
    expect(document.getElementById(panelId)).toHaveAttribute("inert");

    await user.click(btn1);
    expect(btn1).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(panelId)).not.toHaveAttribute("inert");

    // single-open: abrir o 2 fecha o 1
    await user.click(btn2);
    expect(btn1).toHaveAttribute("aria-expanded", "false");
    expect(btn2).toHaveAttribute("aria-expanded", "true");

    // teclado
    btn1.focus();
    await user.keyboard("{Enter}");
    expect(btn1).toHaveAttribute("aria-expanded", "true");
  });

  it("conteúdo permanece no HTML mesmo fechado (SEO)", () => {
    render(<Accordion items={items} />);
    expect(screen.getByText("Resposta 2")).toBeInTheDocument();
  });
});
