import { colors as theme, fonts, radius as themeRadius, typography } from "../theme/tokens";

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
  heading: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  caption: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.textFaint },
};
