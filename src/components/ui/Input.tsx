import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";
import { Text } from "./Text";

export type InputProps = TextInputProps & { label?: string; error?: string | null; hint?: string };

export function Input({ label, error, hint, style, multiline, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text variant="label" tone="secondary">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        keyboardAppearance="light"
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
        style={[
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderRadius: multiline ? radius.lg : radius.pill,
            borderWidth: 1,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            minHeight: multiline ? 120 : 52,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" tone="danger">{error}</Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">{hint}</Text>
      ) : null}
    </View>
  );
}
