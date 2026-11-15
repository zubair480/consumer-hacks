import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, radius } from "./tokens";

export function Field({ style, multiline, ...rest }: TextInputProps & { testID: string }) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      selectionColor={colors.accent}
      keyboardAppearance="dark"
      multiline={multiline}
      style={[styles.input, multiline && styles.multi, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 16 },
  multi: { minHeight: 140, textAlignVertical: "top", paddingTop: 14 },
});
