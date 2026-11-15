import type { ContentType } from "../shared/contracts";

// OWNER: Lead. Design tokens, the single source. Zapy: light, pastel and bold.
// Ink CTAs on a warm off-white canvas, pastel fills by content type, and a soft
// holographic band behind at most one header per screen.

export const palette = {
  canvas: "#FAFAF7",
  white: "#FFFFFF",
  paper: "#F2F2EE",
  paperPressed: "#E8E8E3",
  ink: "#0E0E10",
  inkSoft: "#2A2A2E",
  text2: "#5E5E66",
  text3: "#9A9AA3",
  hairline: "rgba(0,0,0,0.08)",
  hairlineStrong: "rgba(0,0,0,0.14)",
  butter: "#F7E37A",
  lavender: "#CDBEFF",
  peach: "#FFC9B0",
  mint: "#B8F0DA",
  sky: "#BFE3FF",
  green: "#1F9D6B",
  amber: "#A86A00",
  red: "#D93B4A",
  blue: "#2F6FDB",
  coral: "#E0583A",
} as const;

export const colors = {
  background: palette.canvas,
  surface: palette.white,
  surfaceRaised: palette.paper,
  surfacePressed: palette.paperPressed,
  border: palette.hairline,
  borderStrong: palette.hairlineStrong,
  text: palette.ink,
  textSecondary: palette.text2,
  textMuted: palette.text3,
  textInverse: palette.white,
  primary: palette.ink,
  primaryPressed: palette.inkSoft,
  onPrimary: palette.white,
  accent: palette.coral,
  success: palette.green,
  warning: palette.amber,
  danger: palette.red,
  info: palette.blue,
  overlay: "rgba(14,14,16,0.40)",
  warningSoft: "#FFF6D1",
  dangerSoft: "#FDE7E9",
} as const;

/** Holographic header band (refB). Soft backdrop only, never on buttons; at most one per screen. */
export const gradients = {
  holo: ["#FFD6E8", "#FFF3B0", "#C9F2E4", "#CFE0FF"] as const,
  holoOpacity: 0.6,
};

/** Pastel fill per content type, always paired with ink text. */
export const contentTypeColors: Record<ContentType, string> = {
  scholarship: palette.butter,
  application: palette.butter,
  job: palette.butter,
  github_repository: palette.lavender,
  code_snippet: palette.lavender,
  tutorial: palette.lavender,
  restaurant: palette.peach,
  recipe: palette.peach,
  travel: palette.peach,
  event: palette.peach,
  graphic: palette.mint,
  product: palette.mint,
  research: palette.sky,
  general_content: palette.sky,
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 10, md: 16, lg: 20, xl: 28, card: 28, row: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 40, lineHeight: 40, fontWeight: "900", letterSpacing: -1, textTransform: "uppercase" },
  title: { fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: "800", letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  label: { fontSize: 13, lineHeight: 17, fontWeight: "600" },
  mono: { fontSize: 14, lineHeight: 20, fontFamily: "Menlo" },
} as const;

export const shadows = {
  card: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  glow: {},
} as const;

export const motion = { fast: 120, normal: 220, slow: 360, pressScale: 0.97 } as const;

export const theme = { colors, palette, gradients, contentTypeColors, spacing, radius, typography, shadows, motion } as const;
export type Theme = typeof theme;
