import { fonts, palette } from "../../theme";

export const studioText = {
  headline: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 24, color: palette.ink },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: palette.ink },
  callout: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: palette.ink },
  footnote: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: "#5B5B63" },
  overline: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase" as const, color: palette.ink },
  error: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: "#E5484D" },
};

export const elevation = {
  e1: { shadowColor: palette.ink, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  e2: { shadowColor: palette.ink, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};
