import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "../../theme";
import { Text } from "./Text";

export type ScreenProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Element on the right of the title row (e.g. an IconButton). */
  headerRight?: ReactNode;
  /** Wraps content in a ScrollView. Set false for screens that own a FlatList. */
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Dark full-screen container with safe areas, optional large title, and keyboard handling. */
export function Screen({ children, title, subtitle, headerRight, scroll = true, padded = true, edges = ["top"], testID, contentStyle }: ScreenProps) {
  const header = title ? (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="title" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
      </View>
      {headerRight}
    </View>
  ) : null;
  const inner = [{ padding: padded ? spacing.lg : 0, gap: spacing.lg }, contentStyle];
  return (
    <SafeAreaView testID={testID} edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={[inner, { paddingBottom: spacing.xxxl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, inner]}>
            {header}
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
