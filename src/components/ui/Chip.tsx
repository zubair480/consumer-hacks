import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { CONTENT_TYPE_LABELS, type ContentType } from "../../shared/contracts";
import { colors, contentTypeColors, radius, spacing } from "../../theme";
import type { IconName } from "./Button";
import { ScalePressable } from "./Pressable";
import { Text } from "./Text";

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Accent color for the dot and selected state. */
  color?: string;
  icon?: IconName;
  testID?: string;
};

export function Chip({ label, selected, onPress, color = colors.primary, icon, testID }: ChipProps) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        height: 32,
        borderRadius: radius.pill,
        backgroundColor: selected ? color : colors.surfaceRaised,
        borderWidth: 1,
        borderColor: selected ? color : colors.border,
      }}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? colors.textInverse : color} />
      ) : (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: selected ? colors.textInverse : color }} />
      )}
      <Text variant="caption" color={selected ? colors.textInverse : colors.text} style={{ fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label} onPress={onPress} scaleTo={0.94}>
      {body}
    </ScalePressable>
  );
}

/** Chip preset for a content type: label and color come from the contracts + theme. */
export function ContentTypeChip({ type, ...rest }: { type: ContentType } & Omit<ChipProps, "label" | "color">) {
  return <Chip label={CONTENT_TYPE_LABELS[type]} color={contentTypeColors[type]} {...rest} />;
}
