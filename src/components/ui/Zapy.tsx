import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ScrollView, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ContentType } from "../../shared/contracts";
import { colors, contentTypeColors, gradients, palette, radius, spacing } from "../../theme";
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

const shadowSoft = { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 } as const;

/** refB headline: 44/900 uppercase; the highlight word sits on a pastel block. */
export function DisplayTitle({ children, highlight, highlightColor = palette.butter, testID }: { children: string; highlight?: string; highlightColor?: string; testID?: string }) {
  const style = { fontSize: 44, lineHeight: 48, fontWeight: "900" as const, letterSpacing: -1.5, color: colors.text, textTransform: "uppercase" as const };
  if (!highlight) {
    return (
      <Text accessibilityRole="header" testID={testID} numberOfLines={3} style={style}>
        {children}
      </Text>
    );
  }
  const words = children.split(" ");
  return (
    <View accessibilityRole="header" accessibilityLabel={children} testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 2 }}>
      {words.map((w, i) =>
        w.toLowerCase() === highlight.toLowerCase() ? (
          <View key={i} style={{ backgroundColor: highlightColor, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={style}>{w}</Text>
          </View>
        ) : (
          <Text key={i} style={[style, { paddingVertical: 2 }]}>
            {w}
          </Text>
        ),
      )}
    </View>
  );
}

/** refA top: 44px avatar (initial on butter), greeting and counts. No "+". */
export function HomeHeader({ name, saves, ready, onAvatarPress, testID }: { name: string; saves?: number; ready?: number; onAvatarPress?: () => void; testID?: string }) {
  const avatar = (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.butter, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>{name.trim().charAt(0).toUpperCase() || "Z"}</Text>
    </View>
  );
  const sub = [saves !== undefined ? `${saves} ${saves === 1 ? "save" : "saves"}` : null, ready ? `${ready} ready` : null].filter(Boolean).join(" · ");
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      {onAvatarPress ? (
        <ScalePressable accessibilityRole="button" accessibilityLabel="Profile" onPress={onAvatarPress} scaleTo={0.92}>
          {avatar}
        </ScalePressable>
      ) : (
        avatar
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text }}>Hi, {name}</Text>
        {sub ? <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/** Older header with a custom right slot; kept for existing callers. */
export function Header({ name, saves, right, testID }: { name: string; saves?: number; right?: ReactNode; onAvatarPress?: () => void; testID?: string }) {
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <HomeHeader name={name} saves={saves} />
      {right}
    </View>
  );
}

/** 56 tall white search pill with a soft shadow and an ink filter button. */
export function SearchPill({ style, placeholder = "Find a save", onFilterPress, filterTestID, ...rest }: TextInputProps & { onFilterPress?: () => void; filterTestID?: string }) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 56, paddingLeft: spacing.xl, paddingRight: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        shadowSoft,
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
        style={{ flex: 1, fontSize: 15, color: colors.text, height: 56 }}
      />
      <ScalePressable testID={filterTestID} accessibilityRole="button" accessibilityLabel="Filter" disabled={!onFilterPress} onPress={onFilterPress} scaleTo={0.9}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="options-outline" size={18} color={colors.onPrimary} />
        </View>
      </ScalePressable>
    </View>
  );
}

/** Pastel type pill with an optional count. Selected = ink fill. */
export function TypeChip({ label, count, type, color, selected, onPress, testID }: { label: string; count?: number; type?: ContentType; color?: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  const fill = selected ? colors.primary : (color ?? (type ? pastelFor(type) : colors.surface));
  const fg = selected ? colors.onPrimary : colors.text;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 40, paddingLeft: spacing.lg, paddingRight: count !== undefined ? 6 : spacing.lg, borderRadius: radius.pill, backgroundColor: fill, borderWidth: fill === colors.surface ? 1 : 0, borderColor: colors.border }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: fg }}>{label}</Text>
      {count !== undefined ? (
        <View style={{ minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8, backgroundColor: selected ? "rgba(255,255,255,0.2)" : colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: fg }}>{count}</Text>
        </View>
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

export type CountChip = { key: string; label: string; count?: number; type?: ContentType; selected?: boolean; testID?: string };

/** refA "UI Design 23" row: horizontal scroll of pastel chips with white count pills; "All" is ink. */
export function CountChips({ chips, onPress, inset = spacing.xl }: { chips: CountChip[]; onPress?: (key: string) => void; inset?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -inset }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: inset }}>
      {chips.map((c) => (
        <TypeChip key={c.key} testID={c.testID} label={c.label} count={c.count} type={c.type} color={c.type ? undefined : colors.surface} selected={c.selected ?? c.key === "all"} onPress={onPress ? () => onPress(c.key) : undefined} />
      ))}
    </ScrollView>
  );
}

function domainOf(source?: string) {
  return source?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
}

/** refA "Business Analytics": the signature card. 280x340 pastel, label pill, big title, glyph, white run bar. */
export function HeroTypeCard({
  type,
  typeLabel,
  title,
  summary,
  source,
  age,
  actionLabel,
  onPress,
  onRun,
  width = 280,
  height = 340,
  fullBleed,
  testID,
  runTestID,
}: {
  type?: ContentType;
  typeLabel?: string;
  title: string;
  summary?: string;
  source?: string;
  age?: string;
  actionLabel?: string;
  onPress?: () => void;
  onRun?: () => void;
  width?: number | "100%";
  height?: number;
  fullBleed?: boolean;
  testID?: string;
  runTestID?: string;
}) {
  const domain = domainOf(source);
  const content = (
    <>
      <Ionicons name={`${typeIconFor(type)}-outline` as IconName} size={120} color="rgba(14,14,16,0.10)" style={{ position: "absolute", right: -8, bottom: actionLabel ? 64 : -8 }} />
      <View style={{ gap: spacing.sm }}>
        {typeLabel ? (
          <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.6)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: colors.text, textTransform: "uppercase" }}>{typeLabel}</Text>
          </View>
        ) : null}
        <Text style={{ fontSize: 28, lineHeight: 31, fontWeight: "900", letterSpacing: -0.6, color: colors.text }} numberOfLines={3}>
          {title}
        </Text>
        {summary ? (
          <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 19, color: "rgba(14,14,16,0.7)" }}>
            {summary}
          </Text>
        ) : null}
        {domain || age ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="link" size={11} color={colors.onPrimary} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, flexShrink: 1 }} numberOfLines={1}>
              {[domain, age].filter(Boolean).join(" · ")}
            </Text>
          </View>
        ) : null}
      </View>
      {actionLabel ? (
        <ScalePressable
          testID={runTestID}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          disabled={!onRun && !onPress}
          onPress={onRun ?? onPress}
          scaleTo={0.97}
          style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.pill, paddingLeft: spacing.xl, paddingRight: 6 }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 }} numberOfLines={1}>
            {actionLabel}
          </Text>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="play" size={18} color={colors.onPrimary} />
          </View>
        </ScalePressable>
      ) : null}
    </>
  );
  const style: StyleProp<ViewStyle> = {
    width,
    minHeight: fullBleed ? undefined : height,
    backgroundColor: pastelFor(type),
    borderRadius: 32,
    padding: spacing.xl,
    gap: spacing.lg,
    justifyContent: "space-between",
    overflow: "hidden",
  };
  if (!onPress) return <View testID={testID} style={style}>{content}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} scaleTo={0.98} style={style}>
      {content}
    </ScalePressable>
  );
}

const WAVE = "M0 18 C 60 0, 120 0, 180 14 S 300 30, 360 12 L 360 40 L 0 40 Z";

/** refB wavy block: 112 tall, pastel, wavy top; eyebrow over name on the left, big count (or a custom slot) on the right. */
export function WaveBlock({ label, eyebrow, count, color, right, last, onPress, selected, testID }: { label: string; eyebrow?: string; count?: number; color: string; right?: ReactNode; last?: boolean; onPress?: () => void; selected?: boolean; testID?: string }) {
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={eyebrow ? `${label}, ${eyebrow}` : label}
      disabled={!onPress}
      onPress={onPress}
      scaleTo={0.98}
    >
      <Svg width="100%" height={24} viewBox="0 0 360 40" preserveAspectRatio="none">
        <Path d={WAVE} fill={color} />
      </Svg>
      <View
        style={{
          height: 112 - 24,
          marginTop: -1,
          backgroundColor: color,
          paddingHorizontal: spacing.xl,
          paddingBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomLeftRadius: last ? radius.card : 0,
          borderBottomRightRadius: last ? radius.card : 0,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          {eyebrow ? <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: "800", letterSpacing: 1, color: colors.text, textTransform: "uppercase" }}>{eyebrow}</Text> : null}
          <Text style={{ fontSize: 26, lineHeight: 31, fontWeight: "900", letterSpacing: -0.5, color: colors.text }} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {right ?? (count !== undefined ? <Text style={{ fontSize: 44, lineHeight: 50, fontWeight: "900", letterSpacing: -1, color: colors.text }}>{count}</Text> : null)}
      </View>
    </ScalePressable>
  );
}

export type WaveBlockItem = { key: string; label: string; count: number; color: string; testID?: string };

/** Stack of WaveBlocks with -18px overlap so the waves layer. Tapping one filters. */
export function WaveBlocks({ blocks, selected, onPress }: { blocks: WaveBlockItem[]; selected?: string | null; onPress?: (key: string) => void }) {
  return (
    <View>
      {blocks.map((b, i) => (
        <View key={b.key} style={{ marginTop: i === 0 ? 0 : -18, zIndex: i }}>
          <WaveBlock
            testID={b.testID}
            label={b.label}
            eyebrow={`${b.count} ${b.count === 1 ? "save" : "saves"}`}
            count={b.count}
            color={b.color}
            selected={selected === b.key}
            last={i === blocks.length - 1}
            onPress={onPress ? () => onPress(b.key) : undefined}
          />
        </View>
      ))}
    </View>
  );
}

const STATUS_DOT: Record<string, string> = { ready: colors.success, working: palette.butter, failed: colors.danger };

/** 76 tall white row: 52px pastel square with the type icon, one-line title, meta, status dot + chevron. */
export function ItemRow({ type, title, meta, status, right, onPress, testID }: { type?: ContentType; title: string; meta?: string; status?: "ready" | "working" | "failed"; right?: ReactNode; onPress?: () => void; testID?: string }) {
  const body = (
    <>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: pastelFor(type), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={typeIconFor(type)} size={22} color={colors.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {status ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_DOT[status] }} /> : null}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      )}
    </>
  );
  const style: StyleProp<ViewStyle> = [
    { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: 12, paddingRight: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.row },
    shadowSoft,
  ];
  if (!onPress) return <View testID={testID} style={style}>{body}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} scaleTo={0.98} style={style}>
      {body}
    </ScalePressable>
  );
}

/** Ink card CTA (Import): 88 tall, glyph, white title and sub, white circle with an ink arrow. */
export function InkCTA({ title, subtitle, icon = "logo-x", onPress, testID }: { title: string; subtitle?: string; icon?: IconName; onPress?: () => void; testID?: string }) {
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      scaleTo={0.98}
      style={{ minHeight: 88, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.card, backgroundColor: colors.primary }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={colors.onPrimary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: colors.onPrimary }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{subtitle}</Text> : null}
      </View>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="arrow-forward" size={20} color={colors.text} />
      </View>
    </ScalePressable>
  );
}

/** Tab bar styles shared by src/app/(tabs)/_layout.tsx. */
export const tabBarTheme = {
  activeTint: colors.text,
  inactiveTint: colors.textMuted,
  style: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 } as ViewStyle,
  label: { fontSize: 11, fontWeight: "700" as const },
  scene: { backgroundColor: colors.background },
};

/** Center tab: a 64px ink circle raised 16px with a white "+". The only "+" in the app. */
export function TabPlus() {
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginTop: -32,
        borderWidth: 4,
        borderColor: colors.surface,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Ionicons name="add" size={32} color={colors.onPrimary} />
    </View>
  );
}
