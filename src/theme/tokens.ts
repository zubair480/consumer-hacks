import type { ContentType } from "../shared/contracts";

// OWNER: Lead. Design tokens. Dark-first: bold cards on a near-black canvas.

export const palette = {
  ink950: "#07070B",
  ink900: "#0D0D14",
  ink850: "#13131C",
  ink800: "#1A1A26",
  ink700: "#262635",
  ink600: "#363648",
  ink400: "#6E6E85",
  ink300: "#9A9AB0",
  ink100: "#E6E6F0",
  white: "#FFFFFF",
  violet: "#8B7CFF",
  violetDeep: "#5B47F5",
  coral: "#FF7A59",
  mint: "#3DDC97",
  amber: "#FFC24B",
  red: "#FF5C6C",
  sky: "#4CC3FF",
  pink: "#FF6FB5",
} as const;

export const colors = {
  background: palette.ink950,
  surface: palette.ink850,
  surfaceRaised: palette.ink800,
  surfacePressed: palette.ink700,
  border: palette.ink700,
  borderStrong: palette.ink600,
  text: palette.white,
  textSecondary: palette.ink300,
  textMuted: palette.ink400,
  textInverse: palette.ink950,
  primary: palette.violet,
  primaryPressed: palette.violetDeep,
  onPrimary: palette.white,
  accent: palette.coral,
  success: palette.mint,
  warning: palette.amber,
  danger: palette.red,
  info: palette.sky,
  overlay: "rgba(7,7,11,0.72)",
} as const;

/** Brand gradient stops for hero cards and the save button. */
export const gradients = {
  brand: [palette.violetDeep, palette.violet, palette.coral] as const,
};

/** One accent per content type, used by chips, card stripes, and icons. */
export const contentTypeColors: Record<ContentType, string> = {
  restaurant: palette.coral,
  github_repository: palette.ink100,
  code_snippet: palette.sky,
  scholarship: palette.amber,
  job: palette.mint,
  application: palette.amber,
  graphic: palette.pink,
  recipe: "#FF9F43",
  event: palette.violet,
  travel: "#2ED3C6",
  product: "#B8E986",
  research: "#A5B4FC",
  tutorial: "#7DD3FC",
  general_content: palette.ink300,
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -0.8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.5 },
  heading: { fontSize: 19, lineHeight: 24, fontWeight: "700", letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  mono: { fontSize: 14, lineHeight: 20, fontFamily: "Menlo" },
} as const;

export const shadows = {
  card: { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  glow: { shadowColor: palette.violet, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
} as const;

export const motion = { fast: 120, normal: 220, slow: 360, pressScale: 0.97 } as const;

export const theme = { colors, palette, gradients, contentTypeColors, spacing, radius, typography, shadows, motion } as const;
export type Theme = typeof theme;
