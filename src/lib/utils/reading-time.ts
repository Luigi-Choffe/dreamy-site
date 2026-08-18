/** Tempo de leitura estimado (pt-BR ≈ 200 palavras/min), ignorando frontmatter/código/markup. */
export function readingMinutes(markdown: string, wordsPerMinute = 200): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~\[\]()!-]/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

export function formatReadingTime(minutes: number): string {
  return `${minutes} min de leitura`;
}
