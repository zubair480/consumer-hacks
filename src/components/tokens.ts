export const colors = {
  bg: "#0B0B10",
  surface: "#15151D",
  surfaceRaised: "#1E1E29",
  border: "#2A2A38",
  text: "#F5F5FA",
  textMuted: "#A0A0B4",
  textFaint: "#6B6B80",
  accent: "#8B5CF6",
  accentAlt: "#EC4899",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#60A5FA",
};

export const gradient = ["#8B5CF6", "#EC4899"] as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const type = {
  display: { fontSize: 34, fontWeight: "800" as const, letterSpacing: -0.8, color: colors.text },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4, color: colors.text },
  heading: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
  label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.6, textTransform: "uppercase" as const, color: colors.textFaint },
};
