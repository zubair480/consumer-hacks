import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { colors, typography } from "../../theme";

export type TextVariant = keyof typeof typography;
export type TextTone = "default" | "secondary" | "muted" | "primary" | "accent" | "success" | "warning" | "danger" | "inverse";

const toneColor: Record<TextTone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  primary: colors.primary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  inverse: colors.textInverse,
};

export type TextProps = RNTextProps & { variant?: TextVariant; tone?: TextTone; color?: string; align?: "left" | "center" | "right" };

export function Text({ variant = "body", tone = "default", color, align, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[typography[variant], { color: color ?? toneColor[tone], textAlign: align }, style]} />;
}
