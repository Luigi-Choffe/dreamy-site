/**
 * Tipografia do site (ADR-004).
 * - Instrument Sans: família principal (texto e UI)
 * - Urbanist: família secundária (display/títulos) — continuidade com o site atual
 *
 * Ambas open-source (OFL), self-hosted no build via next/font (sem requests
 * externos em runtime). Para trocar a tipografia, altere apenas este arquivo.
 */
import { Instrument_Sans, Urbanist } from "next/font/google";

export const fontSans = Instrument_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-instrument-sans",
  preload: true,
});

export const fontDisplay = Urbanist({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-urbanist",
  preload: true,
});

export const fontClassNames = `${fontSans.variable} ${fontDisplay.variable}`;
