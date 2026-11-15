import { colors as theme, radius as themeRadius, typography } from "../theme/tokens";

// Feature-component aliases over src/theme/tokens.ts, the single source.

export const colors = {
  bg: theme.background,
  surface: theme.surface,
  surfaceRaised: theme.surfaceRaised,
  border: theme.border,
  text: theme.text,
  textMuted: theme.textSecondary,
  textFaint: theme.textMuted,
  accent: theme.primary,
  accentAlt: theme.accent,
  success: theme.success,
  warning: theme.warning,
  danger: theme.danger,
  info: theme.info,
};

/** Kept for existing callers; Zapy CTAs are solid ink, so both stops are ink. */
export const gradient = [theme.primary, theme.primary] as const;

export const radius = { sm: themeRadius.sm, md: themeRadius.md, lg: themeRadius.row, xl: themeRadius.card, pill: themeRadius.pill };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 };

export const type = {
  display: { ...typography.display, color: colors.text },
  title: { ...typography.title, color: colors.text },
  heading: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: "600" as const, color: colors.textFaint },
};
