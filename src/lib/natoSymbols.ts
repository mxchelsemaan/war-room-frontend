import type { NATOUnitType } from "@/types/units";
import { NATO_SYMBOL_BG } from "@/config/map";

// Interior symbol generators (viewBox is 36×44, rect body from y=8..34)
const INTERIORS: Record<NATOUnitType, (color: string) => string> = {
  infantry: (color) => `
    <line x1="6" y1="12" x2="30" y2="32" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="30" y1="12" x2="6" y2="32" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
  `,
  armor: (color) => `
    <path d="M18,12 L30,22 L18,32 L6,22 Z" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
  `,
  artillery: (color) => `
    <circle cx="18" cy="22" r="8" fill="${color}" opacity="0.9"/>
  `,
  mechanized: (color) => `
    <line x1="6" y1="12" x2="30" y2="32" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="30" y1="12" x2="6" y2="32" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M18,12 L28,21 L18,30 L8,21 Z" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
  `,
  hq: (color) => `
    <text x="18" y="29" text-anchor="middle" font-size="13" font-weight="bold" fill="${color}" font-family="ui-monospace,monospace">HQ</text>
  `,
};

export function natoSVG(type: NATOUnitType, color: string, bg = NATO_SYMBOL_BG): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <rect x="2" y="8" width="32" height="26" rx="1.5" fill="${bg}"/>
    <rect x="2" y="8" width="32" height="26" rx="1.5" fill="none" stroke="${color}" stroke-width="2"/>
    <line x1="3" y1="9.5" x2="33" y2="9.5" stroke="white" stroke-width="0.5" opacity="0.15"/>
    ${INTERIORS[type](color)}
  </svg>`;
}

// Mini SVG for palette buttons (smaller viewBox subset)
export function natoMiniSVG(type: NATOUnitType, color: string, bg = NATO_SYMBOL_BG): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="22" viewBox="0 0 36 44">
    <rect x="2" y="8" width="32" height="26" rx="1.5" fill="${bg}"/>
    <rect x="2" y="8" width="32" height="26" rx="1.5" fill="none" stroke="${color}" stroke-width="2"/>
    ${INTERIORS[type](color)}
  </svg>`;
}
