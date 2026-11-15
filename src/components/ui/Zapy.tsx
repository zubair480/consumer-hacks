import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ContentType } from "../../shared/contracts";
import { colors, contentTypeColors, gradients, radius, spacing, typography } from "../../theme";
import type { IconName } from "./Button";
import { ScalePressable } from "./Pressable";
import { Text } from "./Text";

// OWNER: Lead. Zapy redesign building blocks (handoffs/design/zapy-redesign-spec.md).

const TYPE_ICONS: Record<ContentType, IconName> = {
  restaurant: "restaurant",
  github_repository: "logo-github",
  code_snippet: "code-slash",
  scholarship: "school",
  job: "briefcase",
  application: "document-text",
  graphic: "color-palette",
  recipe: "nutrition",
  event: "calendar",
  travel: "airplane",
  product: "pricetag",
  research: "flask",
  tutorial: "play-circle",
  general_content: "bookmark",
};

export const pastelFor = (type?: ContentType) => contentTypeColors[type ?? "general_content"] ?? contentTypeColors.general_content;
export const typeIconFor = (type?: ContentType): IconName => TYPE_ICONS[type ?? "general_content"] ?? "bookmark";

/** Soft holographic backdrop behind a header (refB). One per screen, never on buttons. */
export function HoloBand({ height = 220, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, height }, style]}>
      <LinearGradient colors={gradients.holo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, opacity: gradients.holoOpacity }} />
      <LinearGradient colors={[colors.background + "00", colors.background]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.45 }} />
    </View>
  );
}

/** Uppercase heavy headline (refB). */
export function DisplayTitle({ children, testID }: { children: string; testID?: string }) {
  return (
    <Text variant="display" accessibilityRole="header" testID={testID} numberOfLines={3}>
      {children}
    </Text>
  );
}

/** "Hi, {name}" with "{n} saves" and an avatar circle (refA). */
export function Header({ name, saves, right, onAvatarPress, testID }: { name: string; saves?: number; right?: ReactNode; onAvatarPress?: () => void; testID?: string }) {
  const avatar = (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
      <Text variant="bodyStrong" color={colors.onPrimary}>
        {name.trim().charAt(0).toUpperCase() || "Z"}
      </Text>
    </View>
  );
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View>
        <Text style={{ fontSize: 15, fontWeight: "700" }}>Hi, {name}</Text>
        {saves !== undefined ? (
          <Text variant="caption" tone="secondary">
            {saves} {saves === 1 ? "save" : "saves"}
          </Text>
        ) : null}
      </View>
      {right ??
        (onAvatarPress ? (
          <ScalePressable accessibilityRole="button" accessibilityLabel="Profile" onPress={onAvatarPress} scaleTo={0.92}>
            {avatar}
          </ScalePressable>
        ) : (
          avatar
        ))}
    </View>
  );
}

/** White search pill, 52 tall, with a search icon. */
export function SearchPill({ style, placeholder = "Find a save", ...rest }: TextInputProps) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 52, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        style as StyleProp<ViewStyle>,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        keyboardAppearance="light"
        returnKeyType="search"
        {...rest}
        style={[typography.body, { flex: 1, color: colors.text, height: 52 }]}
      />
    </View>
  );
}

/** Pastel type pill with an optional count (refA "UI Design 23"). Selected = ink fill. */
export function TypeChip({ label, count, type, color, selected, onPress, testID }: { label: string; count?: number; type?: ContentType; color?: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  const fill = selected ? colors.primary : (color ?? (type ? pastelFor(type) : colors.surface));
  const fg = selected ? colors.onPrimary : colors.text;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: fill, borderWidth: fill === colors.surface ? 1 : 0, borderColor: colors.border }}>
      <Text variant="label" color={fg}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="label" color={fg} style={{ opacity: 0.6 }}>
          {count}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label} onPress={onPress} scaleTo={0.94}>
      {body}
    </ScalePressable>
  );
}

/** Pastel hero card (refA "Business Analytics") with a white run bar at the bottom. */
export function HeroTypeCard({
  type,
  typeLabel,
  title,
  summary,
  source,
  actionLabel,
  onPress,
  onRun,
  width,
  testID,
  runTestID,
}: {
  type?: ContentType;
  typeLabel?: string;
  title: string;
  summary?: string;
  source?: string;
  actionLabel?: string;
  onPress?: () => void;
  onRun?: () => void;
  width?: number;
  testID?: string;
  runTestID?: string;
}) {
  const content = (
    <>
      {typeLabel ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Ionicons name={typeIconFor(type)} size={14} color={colors.text} />
          <Text variant="label">{typeLabel}</Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 26, lineHeight: 30, fontWeight: "800", letterSpacing: -0.5, color: colors.text }} numberOfLines={3}>
        {title}
      </Text>
      {summary ? (
        <Text tone="secondary" numberOfLines={2} style={{ color: "rgba(14,14,16,0.7)" }}>
          {summary}
        </Text>
      ) : null}
      {source ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Ionicons name="link" size={13} color={colors.text} />
          <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
            {source}
          </Text>
        </View>
      ) : null}
      {actionLabel ? (
        <ScalePressable
          testID={runTestID}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          disabled={!onRun && !onPress}
          onPress={onRun ?? onPress}
          scaleTo={0.97}
          style={{ marginTop: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.pill, paddingLeft: spacing.xl, padding: 6 }}
        >
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {actionLabel}
          </Text>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="play" size={18} color={colors.onPrimary} />
          </View>
        </ScalePressable>
      ) : null}
    </>
  );
  const style: StyleProp<ViewStyle> = { width, backgroundColor: pastelFor(type), borderRadius: radius.card, padding: spacing.xl, gap: spacing.sm };
  if (!onPress) return <View testID={testID} style={style}>{content}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} scaleTo={0.98} style={style}>
      {content}
    </ScalePressable>
  );
}

export type WaveBlock = { key: string; label: string; count: number; color: string; testID?: string };

const WAVE = "M0 18 C 60 0, 120 0, 180 14 S 300 30, 360 12 L 360 40 L 0 40 Z";

/** Stacked full-width pastel blocks with a wavy top edge (refB). Tapping one filters. */
export function WaveBlocks({ blocks, selected, onPress }: { blocks: WaveBlock[]; selected?: string | null; onPress?: (key: string) => void }) {
  return (
    <View>
      {blocks.map((b, i) => (
        <ScalePressable
          key={b.key}
          testID={b.testID}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === b.key }}
          accessibilityLabel={`${b.label}, ${b.count} saves`}
          onPress={() => onPress?.(b.key)}
          scaleTo={0.98}
          style={{ marginTop: i === 0 ? 0 : -18, zIndex: i }}
        >
          <Svg width="100%" height={24} viewBox="0 0 360 40" preserveAspectRatio="none">
            <Path d={WAVE} fill={b.color} />
          </Svg>
          <View
            style={{
              backgroundColor: b.color,
              marginTop: -1,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xs,
              paddingBottom: spacing.xxl,
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              borderBottomLeftRadius: i === blocks.length - 1 ? radius.card : 0,
              borderBottomRightRadius: i === blocks.length - 1 ? radius.card : 0,
            }}
          >
            <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.3, color: colors.text }}>{b.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
              <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: "900", color: colors.text }}>{b.count}</Text>
              <Text variant="label" style={{ fontWeight: "800" }}>
                SAVES
              </Text>
            </View>
          </View>
        </ScalePressable>
      ))}
    </View>
  );
}

/** White row card: pastel icon square, title, meta and a chevron. */
export function ItemRow({ type, title, meta, right, onPress, testID }: { type?: ContentType; title: string; meta?: string; right?: ReactNode; onPress?: () => void; testID?: string }) {
  const body = (
    <>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: pastelFor(type), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={typeIconFor(type)} size={24} color={colors.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }} numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </>
  );
  const style: StyleProp<ViewStyle> = { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, paddingRight: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.row, borderWidth: 1, borderColor: colors.border };
  if (!onPress) return <View testID={testID} style={style}>{body}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} scaleTo={0.98} style={style}>
      {body}
    </ScalePressable>
  );
}

/** Tab bar styles shared by src/app/(tabs)/_layout.tsx. */
export const tabBarTheme = {
  activeTint: colors.text,
  inactiveTint: colors.textMuted,
  style: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 } as ViewStyle,
  label: { fontSize: 11, fontWeight: "600" as const },
  scene: { backgroundColor: colors.background },
};

/** Center "+" tab: 56 ink circle with a white plus. */
export function TabPlus() {
  return (
    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: -18 }}>
      <Ionicons name="add" size={30} color={colors.onPrimary} />
    </View>
  );
}
