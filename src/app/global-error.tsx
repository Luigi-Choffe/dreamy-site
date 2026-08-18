"use client";

/** Fallback global (falha no root layout). Sem dependências de estilo do app. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f8f8", color: "#0b0b0c", margin: 0 }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", lineHeight: 1.1, marginBottom: "1rem" }}>Algo não funcionou como esperado.</h1>
          <p style={{ color: "#575c61", marginBottom: "2rem" }}>
            Ocorreu um erro ao carregar o site. Tente novamente ou volte para a página inicial.
          </p>
          {error.digest ? <p style={{ fontSize: 12, color: "#6b7075" }}>Código: {error.digest}</p> : null}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#46eb7e",
                color: "#0b0b0c",
                border: 0,
                borderRadius: 999,
                padding: "0.9rem 1.5rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- o roteador pode estar indisponível quando o root layout falha */}
            <a
              href="/"
              style={{
                border: "1px solid #c3c8cc",
                borderRadius: 999,
                padding: "0.9rem 1.5rem",
                fontWeight: 600,
                color: "#0b0b0c",
                textDecoration: "none",
              }}
            >
              Voltar para a Dreamy
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
