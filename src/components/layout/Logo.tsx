import Image from "next/image";
import Link from "next/link";
import { routes, siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

interface LogoProps {
  /** Usa a versão com wordmark claro (fundo escuro). */
  onDark?: boolean;
  /** Largura em px (a altura segue a proporção 927×261). */
  width?: number;
  className?: string;
  priority?: boolean;
  /** Renderiza sem link (ex.: dentro de um link maior). */
  asImage?: boolean;
  /** Tamanho controlado por classes CSS (ex.: `w-[104px] sm:w-[124px]`) em vez de inline. */
  fluid?: boolean;
}

const RATIO = 261 / 927;

export function Logo({
  onDark = false,
  width = 132,
  className,
  priority = false,
  asImage = false,
  fluid = false,
}: LogoProps) {
  const height = Math.round(width * RATIO);
  // Logos pequenos (header/footer) usam o asset 2x já otimizado (300 px), sem passar pelo
  // otimizador de imagens: descoberta imediata no HTML e LCP mais rápido.
  const small = width <= 150;
  const src = small
    ? onDark
      ? "/brand/dreamy-logo-dark-bg-sm.png"
      : "/brand/dreamy-logo-sm.png"
    : onDark
      ? "/brand/dreamy-logo-dark-bg.png"
      : "/brand/dreamy-logo.png";
  const img = (
    <Image
      src={src}
      alt={siteConfig.name}
      width={width}
      height={height}
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      unoptimized={small}
      className={cn("h-auto", className)}
      style={fluid ? undefined : { width, height }}
    />
  );
  if (asImage) return img;
  return (
    <Link
      href={routes.home}
      aria-label={`${siteConfig.name} — página inicial`}
      className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      {img}
    </Link>
  );
}

export function LogoSymbol({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/dreamy-symbol.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}
