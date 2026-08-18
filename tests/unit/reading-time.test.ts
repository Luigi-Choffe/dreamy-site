import { describe, expect, it } from "vitest";
import { formatReadingTime, readingMinutes } from "@/lib/utils/reading-time";

describe("readingMinutes", () => {
  it("mínimo de 1 minuto e arredonda por ~200 palavras/min", () => {
    expect(readingMinutes("uma frase curta")).toBe(1);
    const words = Array.from({ length: 610 }, (_, i) => `palavra${i}`).join(" ");
    expect(readingMinutes(words)).toBe(3);
  });
  it("ignora blocos de código e markup", () => {
    const md = "# Título\n\n```js\nconst a = 1; const b = 2; const c = 3;\n```\n\n<Callout>texto</Callout> **negrito**";
    expect(readingMinutes(md)).toBe(1);
  });
  it("formata em pt-BR", () => {
    expect(formatReadingTime(4)).toBe("4 min de leitura");
  });
});
