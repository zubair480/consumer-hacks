import type { ContentType } from "../shared/contracts";

// OWNER: Lead. Design tokens, the single source. Zapy v3 (handoffs/ui-spec-v3.md):
// pure white, ink, refA pastels, Archivo Black display + Plus Jakarta Sans UI.

export const fonts = {
  display: "ArchivoBlack_400Regular",
  extraBold: "PlusJakartaSans_800ExtraBold",
  bold: "PlusJakartaSans_700Bold",
  medium: "PlusJakartaSans_500Medium",
} as const;

export const palette = {
  white: "#FFFFFF",
  ink: "#111111",
  inkSoft: "#2A2A2A",
  grey: "#F4F4F5",
  greyPressed: "#E9E9EB",
  hairline: "#ECECEC",
  text2: "#8A8A93",
  text3: "#B5B5BD",
  butter: "#F8E58C",
  mint: "#A8EBD9",
  peach: "#FFD3C2",
  lavender: "#D9CCFF",
  lime: "#E8F59A",
  cyan: "#A6E6F0",
  green: "#1F9D6B",
  amber: "#A86A00",
  red: "#D93B4A",
  blue: "#2F6FDB",
  coral: "#E0583A",
  /** v2 names kept for existing callers. */
  canvas: "#FFFFFF",
  paper: "#F4F4F5",
  paperPressed: "#E9E9EB",
  sky: "#A6E6F0",
} as const;

export const colors = {
  background: palette.white,
  surface: palette.white,
  surfaceRaised: palette.grey,
  surfacePressed: palette.greyPressed,
  border: palette.hairline,
  borderStrong: "#DADADD",
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
  overlay: "rgba(17,17,17,0.40)",
  warningSoft: "#FCF3C9",
  dangerSoft: "#FDE7E9",
} as const;

/** Holographic (refB): a 160px fade at the top of Home and Library, and a 6px strip on WaveBlock bottoms. */
export const gradients = {
  holo: ["#FFD1E3", "#FFF2B3", "#BFF0E6", "#D3DAFF"] as const,
  holoOpacity: 0.7,
};

/** Pastel fill per content type, always paired with ink text. */
export const contentTypeColors: Record<ContentType, string> = {
  scholarship: palette.butter,
  job: palette.butter,
  application: palette.butter,
  github_repository: palette.lavender,
  code_snippet: palette.lavender,
  tutorial: palette.lavender,
  restaurant: palette.peach,
  recipe: palette.peach,
  travel: palette.peach,
  graphic: palette.mint,
  product: palette.mint,
  event: palette.lime,
  research: palette.cyan,
  general_content: palette.cyan,
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, card: 28, row: 20, pill: 999 } as const;

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 38, lineHeight: 38, letterSpacing: -0.5, textTransform: "uppercase" },
  title: { fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 36 },
  heading: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
  mono: { fontSize: 14, lineHeight: 20, fontFamily: "Menlo" },
} as const;

export const shadows = {
  card: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  raised: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  glow: {},
} as const;

export const motion = {
  fast: 120,
  normal: 220,
  slow: 360,
  pressScale: 0.96,
  spring: { damping: 18, stiffness: 320 },
  enter: { duration: 260, offset: 14, stagger: 50 },
} as const;

export const theme = { colors, palette, fonts, gradients, contentTypeColors, spacing, radius, typography, shadows, motion } as const;
export type Theme = typeof theme;
