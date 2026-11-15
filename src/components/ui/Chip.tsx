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
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : color === colors.primary ? colors.surface : color,
        borderWidth: selected || color !== colors.primary ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.onPrimary : colors.text} /> : null}
      <Text variant="label" color={selected ? colors.onPrimary : colors.text}>
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
