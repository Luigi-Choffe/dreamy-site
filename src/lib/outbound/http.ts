import { lookup, Resolver, type LookupOptions } from "node:dns";
import {
  Agent,
  fetch as undiciFetch,
  type RequestInit as UndiciRequestInit,
  type Response as UndiciResponse,
} from "undici";

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

/**
 * `fetch` resiliente do outbound (falha #19, 2026-10-20). O `fetch` global do Node
 * resolve A e AAAA e espera os dois antes de conectar; numa rede em que a consulta
 * AAAA trava, cada requisição estoura o connect timeout de 10 s (UND_ERR_CONNECT_TIMEOUT),
 * e tanto o banco (Neon, `api.<região>.aws.neon.tech`) quanto a API do Resend
 * ficam inalcançáveis, enquanto `curl -4` responde em 1 s. Aqui: família IPv4
 * apenas, HTTP/2 permitido (o caminho rápido que o curl usa), connect de 30 s e
 * cabeçalhos/corpo de 60 s. Vale no CLI, na tarefa agendada e na Vercel (runtime Node).
 */
/**
 * Resolução de nomes própria: o resolvedor do Windows desta máquina trava por até
 * 40 s em alguns nomes (o host regional do Neon, S3), enquanto 1.1.1.1 e 8.8.8.8
 * respondem na hora. Consulta direta a esses servidores (só A), com cache de
 * 5 min em processo; se os dois falharem, cai no `dns.lookup` do sistema.
 */
const resolver = new Resolver({ timeout: 4_000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);
const cache = new Map<string, { ip: string; ate: number }>();
const CACHE_MS = 5 * 60_000;

function lookupResiliente(hostname: string, options: LookupOptions, cb: LookupCallback): void {
  const hit = cache.get(hostname);
  if (hit && hit.ate > Date.now()) {
    cb(null, options.all ? [{ address: hit.ip, family: 4 }] : hit.ip, 4);
    return;
  }
  resolver.resolve4(hostname, (err, addresses) => {
    const ip = addresses?.[0];
    if (!err && ip) {
      cache.set(hostname, { ip, ate: Date.now() + CACHE_MS });
      cb(null, options.all ? addresses.map((address) => ({ address, family: 4 })) : ip, 4);
      return;
    }
    lookup(hostname, { ...options, family: 4 }, cb as never);
  });
}

const agent = new Agent({
  allowH2: true,
  connect: { family: 4, timeout: 30_000, lookup: lookupResiliente },
  headersTimeout: 60_000,
  bodyTimeout: 60_000,
});

export type FetchInput = string | URL;
export type FetchResiliente = (input: FetchInput, init?: UndiciRequestInit) => Promise<UndiciResponse>;

const real: FetchResiliente = (input, init) => undiciFetch(input, { ...init, dispatcher: agent });
let impl: FetchResiliente = real;

export function fetchResiliente(input: FetchInput, init?: UndiciRequestInit): Promise<UndiciResponse> {
  return impl(input, init);
}

/**
 * Só para testes: os testes de auth/config stubam o `fetch` global para falar com
 * um Resend falso; este ponto deixa o mesmo stub valer aqui. `null` restaura o real.
 */
export function setFetchResilienteParaTestes(fn: FetchResiliente | null): void {
  impl = fn ?? real;
}
