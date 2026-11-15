import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ReactNode } from "react";
import { Animated, View, type DimensionValue } from "react-native";
import { colors, radius, spacing } from "../../theme";
import { Button, type IconName } from "./Button";
import { Text } from "./Text";

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text variant="heading">{title}</Text>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

export function EmptyState({
  icon = "sparkles-outline",
  title,
  body,
  actionLabel,
  onAction,
  testID,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text variant="heading" align="center">{title}</Text>
      {body ? <Text tone="secondary" align="center">{body}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ alignSelf: "center" }} testID={testID ? `${testID}-action` : undefined} /> : null}
    </View>
  );
}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ width = "100%", height = 16, rounded = radius.sm }: { width?: DimensionValue; height?: number; rounded?: number }) {
  const [opacity] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ width, height, borderRadius: rounded, backgroundColor: colors.surfaceRaised, opacity }} />;
}
