import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import type { ContentType } from "../../shared/contracts";
import { colors, contentTypeColors, fonts, gradients, palette, radius, shadows, spacing } from "../../theme";
import type { IconName } from "./Button";
import { Doodle, type DoodleKind } from "./Doodle";
import { ScalePressable } from "./Pressable";
import { Text } from "./Text";

// OWNER: Lead. Zapy v3 shared components (handoffs/ui-spec-v3.md, section 4).

const TYPE_ICONS: Record<ContentType, IconName> = {
  restaurant: "restaurant-outline",
  github_repository: "logo-github",
  code_snippet: "code-slash-outline",
  scholarship: "school-outline",
  job: "briefcase-outline",
  application: "document-text-outline",
  graphic: "color-palette-outline",
  recipe: "nutrition-outline",
  event: "calendar-outline",
  travel: "airplane-outline",
  product: "pricetag-outline",
  research: "flask-outline",
  tutorial: "play-circle-outline",
  general_content: "bookmark-outline",
};

const DOODLES: Partial<Record<ContentType, [DoodleKind, DoodleKind]>> = {
  scholarship: ["star", "squiggle"],
  github_repository: ["burst", "arrow"],
  restaurant: ["circle", "squiggle"],
  graphic: ["star", "arrow"],
  event: ["burst", "squiggle"],
};

export const pastelFor = (type?: ContentType) => contentTypeColors[type ?? "general_content"] ?? contentTypeColors.general_content;
export const typeIconFor = (type?: ContentType): IconName => TYPE_ICONS[type ?? "general_content"] ?? "bookmark-outline";

const t = (family: string, size: number, color: string = colors.text, extra?: object) => ({ fontFamily: family, fontSize: size, color, ...extra });

/** Holographic fade (refB). 160px at the top of Home and Library. */
export function HoloBand({ height = 160, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, height }, style]}>
      <LinearGradient colors={gradients.holo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, opacity: gradients.holoOpacity }} />
      <LinearGradient colors={["rgba(255,255,255,0)", colors.background]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.6 }} />
    </View>
  );
}

/** refB "MENU" pill above a DISPLAY headline. */
export function InkPill({ label, testID }: { label: string; testID?: string }) {
  return (
    <View testID={testID} style={{ alignSelf: "flex-start", height: 28, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.primary, justifyContent: "center" }}>
      <Text style={t(fonts.extraBold, 11, colors.onPrimary, { letterSpacing: 1, textTransform: "uppercase" })}>{label}</Text>
    </View>
  );
}

/** DISPLAY headline: Archivo Black, uppercase, 38/38. Optional pastel highlight word. */
export function DisplayTitle({ children, highlight, highlightColor = palette.butter, size = 38, testID }: { children: string; highlight?: string; highlightColor?: string; size?: number; testID?: string }) {
  const style = t(fonts.display, size, colors.text, { lineHeight: size + 4, letterSpacing: -0.5, textTransform: "uppercase" as const });
  if (!highlight) {
    return (
      <Text accessibilityRole="header" testID={testID} style={style}>
        {children}
      </Text>
    );
  }
  return (
    <View accessibilityRole="header" accessibilityLabel={children} testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 2 }}>
      {children.split(" ").map((w, i) =>
        w.replace(/[^\w]/g, "").toLowerCase() === highlight.toLowerCase() ? (
          <View key={i} style={{ backgroundColor: highlightColor, borderRadius: 10, paddingHorizontal: 8 }}>
            <Text style={style}>{w}</Text>
          </View>
        ) : (
          <Text key={i} style={style}>
            {w}
          </Text>
        ),
      )}
    </View>
  );
}

/** refA screen title, 30/800 sentence case. */
export function ScreenTitle({ children, testID }: { children: string; testID?: string }) {
  return (
    <Text accessibilityRole="header" testID={testID} style={t(fonts.extraBold, 30, colors.text, { lineHeight: 36 })}>
      {children}
    </Text>
  );
}

/** Section header 18/800 with an optional underlined "See all". */
export function SectionHeader({ title, actionLabel = "See all", onAction, actionTestID }: { title: string; actionLabel?: string; onAction?: () => void; actionTestID?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={t(fonts.extraBold, 18)}>{title}</Text>
      {onAction ? (
        <ScalePressable testID={actionTestID} accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction}>
          <Text style={t(fonts.bold, 13, colors.text, { textDecorationLine: "underline" })}>{actionLabel}</Text>
        </ScalePressable>
      ) : null}
    </View>
  );
}

/** refA header: "Hi, {name}" + "{n} saves" left, 44px avatar (initial on mint, white ring, shadow) right. No "+". */
export function HomeHeader({ name, saves, ready, onAvatarPress, testID }: { name: string; saves?: number; ready?: number; onAvatarPress?: () => void; testID?: string }) {
  const sub = [saves !== undefined ? `${saves} ${saves === 1 ? "save" : "saves"}` : null, ready ? `${ready} ready` : null].filter(Boolean).join(" · ");
  const avatar = (
    <View style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.mint, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" }, shadows.card]}>
      <Text style={t(fonts.extraBold, 16)}>{name.trim().charAt(0).toUpperCase() || "Z"}</Text>
    </View>
  );
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flex: 1 }}>
        <Text style={t(fonts.extraBold, 16)}>Hi, {name}</Text>
        {sub ? <Text style={t(fonts.medium, 12, colors.textSecondary)}>{sub}</Text> : null}
      </View>
      {onAvatarPress ? (
        <ScalePressable accessibilityRole="button" accessibilityLabel="Profile" onPress={onAvatarPress}>
          {avatar}
        </ScalePressable>
      ) : (
        avatar
      )}
    </View>
  );
}

/** Kept for existing callers: v3 header with an optional right slot instead of the avatar. */
export function Header({ name, saves, right, onAvatarPress, testID }: { name: string; saves?: number; right?: ReactNode; onAvatarPress?: () => void; testID?: string }) {
  if (!right) return <HomeHeader name={name} saves={saves} onAvatarPress={onAvatarPress} testID={testID} />;
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flex: 1 }}>
        <HomeHeader name={name} saves={saves} />
      </View>
      {right}
    </View>
  );
}

/** refA search: 50 tall, grey, no border, scan/filter circle right. `outlined` = refB 1px ink border (Library). */
export function SearchPill({ style, placeholder = "Search your saves", onFilterPress, filterTestID, outlined, ...rest }: TextInputProps & { onFilterPress?: () => void; filterTestID?: string; outlined?: boolean }) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: 10, height: 50, paddingLeft: 16, paddingRight: 7, borderRadius: radius.pill, backgroundColor: outlined ? colors.surface : colors.surfaceRaised, borderWidth: outlined ? 1 : 0, borderColor: colors.text },
        style as StyleProp<ViewStyle>,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.primary}
        keyboardAppearance="light"
        returnKeyType="search"
        {...rest}
        style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text, height: 50, paddingVertical: 0 }}
      />
      <ScalePressable testID={filterTestID} accessibilityRole="button" accessibilityLabel="Filter" disabled={!onFilterPress} onPress={onFilterPress}>
        <View style={[{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, shadows.card]}>
          <Ionicons name="options-outline" size={17} color={colors.text} />
        </View>
      </ScalePressable>
    </View>
  );
}
export const Search = SearchPill;

/** refA chip "UI Design 23": 32 tall, pastel, label 12/700 + count at 60%. Selected = ink. */
export function TypeChip({ label, count, type, color, selected, onPress, testID }: { label: string; count?: number; type?: ContentType; color?: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  const fill = selected ? colors.primary : (color ?? (type ? pastelFor(type) : colors.surfaceRaised));
  const fg = selected ? colors.onPrimary : colors.text;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: fill }}>
      <Text style={t(fonts.bold, 12, fg)}>{label}</Text>
      {count !== undefined ? <Text style={t(fonts.bold, 12, fg, { opacity: 0.6 })}>{count}</Text> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label} onPress={onPress}>
      {body}
    </ScalePressable>
  );
}

export type CountChip = { key: string; label: string; count?: number; type?: ContentType; selected?: boolean; testID?: string };

/** Horizontal chip row, 8px gap. "All" is ink unless another chip is selected. */
export function CountChips({ chips, onPress, inset = spacing.xl }: { chips: CountChip[]; onPress?: (key: string) => void; inset?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -inset, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: inset }}>
      {chips.map((c) => (
        <TypeChip key={c.key} testID={c.testID} label={c.label} count={c.count} type={c.type} selected={c.selected ?? c.key === "all"} onPress={onPress ? () => onPress(c.key) : undefined} />
      ))}
    </ScrollView>
  );
}
export const Chips = CountChips;

function initials(s?: string) {
  const w = (s ?? "").replace(/^https?:\/\/(www\.)?/, "").split(/[\s./_-]+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "Z";
}

/** refA avatar stack: up to 3 overlapping 28px white initials circles plus an ink "+N". */
export function AvatarStack({ labels, extra }: { labels: string[]; extra?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {labels.slice(0, 3).map((l, i) => (
        <View key={i} style={{ width: 28, height: 28, borderRadius: 14, marginLeft: i ? -8 : 0, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.text, alignItems: "center", justifyContent: "center" }}>
          <Text style={t(fonts.extraBold, 10)}>{initials(l)}</Text>
        </View>
      ))}
      {extra ? (
        <View style={{ width: 28, height: 28, borderRadius: 14, marginLeft: -8, backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Text style={t(fonts.extraBold, 10, colors.onPrimary)}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The type icon in a 96px ink-outlined circle, with two doodles over its top-right. */
export function TypeArt({ type, size = 96 }: { type?: ContentType; size?: number }) {
  const [a, b] = DOODLES[type ?? "general_content"] ?? ["star", "squiggle"];
  return (
    <View pointerEvents="none" style={{ width: size + 28, height: size + 28, alignItems: "center", justifyContent: "flex-end" }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: colors.text, backgroundColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={typeIconFor(type)} size={size * 0.42} color={colors.text} />
      </View>
      <View style={{ position: "absolute", top: 0, right: 0 }}>
        <Doodle kind={a} size={34} fill={palette.white} />
      </View>
      <View style={{ position: "absolute", top: 18, left: 0 }}>
        <Doodle kind={b} size={30} />
      </View>
    </View>
  );
}

/** refA "Business Analytics": 353x236 pastel card, title, avatar stack, art at right, white play bar. */
export function HeroTypeCard({
  type,
  typeLabel,
  title,
  summary,
  source,
  age,
  actionLabel,
  facts,
  avatars,
  onPress,
  onRun,
  width = "100%",
  height = 236,
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
  facts?: number;
  avatars?: string[];
  onPress?: () => void;
  onRun?: () => void;
  width?: number | "100%";
  height?: number;
  fullBleed?: boolean;
  testID?: string;
  runTestID?: string;
}) {
  const stack = avatars ?? [source ?? "", typeLabel ?? "", title].filter(Boolean);
  const content = (
    <>
      <View style={{ position: "absolute", right: 12, top: 12 }}>
        <TypeArt type={type} size={fullBleed ? 88 : 80} />
      </View>
      <View style={{ width: "60%", gap: 10 }}>
        {typeLabel ? <Text style={t(fonts.bold, 11, colors.text, { letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.7 })}>{typeLabel}</Text> : null}
        <Text style={t(fonts.extraBold, 26, colors.text, { lineHeight: 30 })} numberOfLines={fullBleed ? 3 : 2}>
          {title}
        </Text>
        <AvatarStack labels={stack} extra={facts} />
        {summary && fullBleed ? (
          <Text style={t(fonts.medium, 14, "rgba(17,17,17,0.72)", { lineHeight: 20 })} numberOfLines={4}>
            {summary}
          </Text>
        ) : null}
        {age && fullBleed ? <Text style={t(fonts.medium, 12, "rgba(17,17,17,0.6)")}>{age}</Text> : null}
      </View>
      {actionLabel ? (
        <View style={{ marginTop: "auto", paddingTop: 16, marginHorizontal: -8 }}>
        <ScalePressable
          testID={runTestID}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          disabled={!onRun && !onPress}
          onPress={onRun ?? onPress}
          haptic
          style={{ height: 52, borderRadius: 26, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 18, paddingRight: 6 }}
        >
          <Text style={t(fonts.bold, 14)} numberOfLines={1}>
            {actionLabel}
          </Text>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="play" size={16} color={colors.onPrimary} style={{ marginLeft: 2 }} />
          </View>
        </ScalePressable>
        </View>
      ) : null}
    </>
  );
  const style: StyleProp<ViewStyle> = { width, minHeight: fullBleed ? undefined : height, backgroundColor: pastelFor(type), borderRadius: 28, padding: 20, paddingBottom: actionLabel ? 12 : 20, overflow: "hidden" };
  if (!onPress) return <View testID={testID} style={style}>{content}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={style}>
      {content}
    </ScalePressable>
  );
}

const WAVE = "M0 12 C 45 0, 90 0, 135 10 S 225 22, 270 10 S 340 0, 360 8 L 360 24 L 0 24 Z";

function CountUp({ to, style }: { to: number; style: object }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce || to <= 0) return;
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 600);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p === 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [to, reduce]);
  return <Text style={style}>{reduce || to <= 0 ? to : n}</Text>;
}

/** refB stacked card: 96 tall, organic wavy top, eyebrow + 22/800 name left, Archivo count + SAVES right, holo strip at the bottom. */
export function WaveBlock({ label, eyebrow, count, color, right, last, onPress, selected, testID }: { label: string; eyebrow?: string; count?: number; color: string; right?: ReactNode; last?: boolean; onPress?: () => void; selected?: boolean; testID?: string }) {
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={eyebrow ? `${label}, ${eyebrow}` : label} disabled={!onPress} onPress={onPress} scaleTo={0.98}>
      <Svg width="100%" height={20} viewBox="0 0 360 24" preserveAspectRatio="none">
        <Path d={WAVE} fill={color} />
      </Svg>
      <View style={{ height: 96 - 20, marginTop: -1, backgroundColor: color, overflow: "hidden", borderBottomLeftRadius: last ? 24 : 0, borderBottomRightRadius: last ? 24 : 0 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14 }}>
          <View style={{ flexShrink: 1 }}>
            {eyebrow ? <Text style={t(fonts.bold, 11, "rgba(17,17,17,0.7)")}>{eyebrow}</Text> : null}
            <Text style={t(fonts.extraBold, 22, colors.text, { lineHeight: 28 })} numberOfLines={1}>
              {label}
            </Text>
          </View>
          {right ??
            (count !== undefined ? (
              <View style={{ alignItems: "flex-end" }}>
                <CountUp to={count} style={t(fonts.display, 30, colors.text, { lineHeight: 34 })} />
                <Text style={t(fonts.bold, 10, colors.text, { letterSpacing: 1 })}>SAVES</Text>
              </View>
            ) : null)}
        </View>
        <LinearGradient colors={gradients.holo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 6 }} />
      </View>
    </ScalePressable>
  );
}

export type WaveBlockItem = { key: string; label: string; count: number; color: string; testID?: string };

/** WaveBlocks stacked with -14px overlap; each slides up on mount (spring, stagger 70ms). Tapping filters. */
export function WaveBlocks({ blocks, selected, onPress }: { blocks: WaveBlockItem[]; selected?: string | null; onPress?: (key: string) => void }) {
  return (
    <View>
      {blocks.map((b, i) => (
        <SlideUpItem key={b.key} index={i} style={{ marginTop: i === 0 ? 0 : -14, zIndex: i }}>
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
        </SlideUpItem>
      ))}
    </View>
  );
}

function SlideUpItem({ index, style, children }: { index: number; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(reduce ? 0 : 24);
  const o = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const d = index * 70;
    const id = setTimeout(() => {
      y.value = withTiming(0, { duration: 320 });
      o.value = withTiming(1, { duration: 260 });
    }, d);
    return () => clearTimeout(id);
  }, [index, reduce, y, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

const STATUS_DOT: Record<string, string> = { ready: colors.success, working: palette.butter, failed: colors.danger };

/** refA "Ongoing" row: 72 tall, white, radius 20, hairline; 48px pastel square, one-line title, meta, chevron. */
export function ItemRow({ type, title, meta, status, right, onPress, testID }: { type?: ContentType; title: string; meta?: string; status?: "ready" | "working" | "failed"; right?: ReactNode; onPress?: () => void; testID?: string }) {
  const body = (
    <>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: pastelFor(type), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={typeIconFor(type)} size={22} color={colors.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={t(fonts.bold, 15)} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={t(fonts.medium, 12, colors.textSecondary)} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {status && status !== "ready" ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_DOT[status] }} /> : null}
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      )}
    </>
  );
  const style: StyleProp<ViewStyle> = { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingRight: 16, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border };
  if (!onPress) return <View testID={testID} style={style}>{body}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={style}>
      {body}
    </ScalePressable>
  );
}

/** Item detail action: white card, number in a 36px pastel circle, title, one line, 40px ink play circle. The whole card runs it. */
export function ActionCard({ index, title, description, color = palette.butter, onPress, loading, disabled, children, testID }: { index: number; title: string; description?: string; color?: string; onPress?: () => void; loading?: boolean; disabled?: boolean; children?: ReactNode; testID?: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>
      <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={`Run ${title}`} disabled={disabled || loading || !onPress} onPress={onPress} haptic style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
          <Text style={t(fonts.extraBold, 14)}>{index}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={t(fonts.extraBold, 16)} numberOfLines={1}>
            {title}
          </Text>
          {description ? (
            <Text style={t(fonts.medium, 13, colors.textSecondary)} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
          <Ionicons name={loading ? "hourglass-outline" : "play"} size={16} color={colors.onPrimary} style={{ marginLeft: loading ? 0 : 2 }} />
        </View>
      </ScalePressable>
      {children}
    </View>
  );
}

/** Fact tile: pastel at 50%, radius 18, uppercase label, value 15/700. */
export function FactTile({ label, value, color = palette.butter, onPress, testID }: { label: string; value: string; color?: string; onPress?: () => void; testID?: string }) {
  const body = (
    <>
      <Text style={t(fonts.bold, 10, "rgba(17,17,17,0.6)", { letterSpacing: 0.8, textTransform: "uppercase" })} numberOfLines={1}>
        {label}
      </Text>
      <Text style={t(fonts.bold, 15)} numberOfLines={3}>
        {value}
      </Text>
    </>
  );
  const style: StyleProp<ViewStyle> = { flex: 1, minHeight: 72, borderRadius: 18, padding: 12, gap: 4, backgroundColor: color + "80" };
  if (!onPress) return <View testID={testID} style={style}>{body}</View>;
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={style}>
      {body}
    </ScalePressable>
  );
}

/** Two-column FactTile grid, 10px gap. */
export function FactGrid({ children }: { children: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  children.forEach((c, i) => (i % 2 ? rows[rows.length - 1].push(c) : rows.push([c])));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          {r}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Ink Import card: 17/800 white title, 70% sub, white arrow circle. */
export function InkCTA({ title, subtitle, icon = "logo-x", onPress, testID }: { title: string; subtitle?: string; icon?: IconName; onPress?: () => void; testID?: string }) {
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} haptic style={{ minHeight: 84, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24, backgroundColor: colors.primary }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={colors.onPrimary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={t(fonts.extraBold, 17, colors.onPrimary)}>{title}</Text>
        {subtitle ? <Text style={t(fonts.medium, 13, "rgba(255,255,255,0.7)")}>{subtitle}</Text> : null}
      </View>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="arrow-forward" size={18} color={colors.text} />
      </View>
    </ScalePressable>
  );
}

/** Tab bar styles for src/app/(tabs)/_layout.tsx: white, hairline, no labels. */
export const tabBarTheme = {
  activeTint: colors.text,
  inactiveTint: palette.text3,
  style: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, height: 84, paddingTop: 10 } as ViewStyle,
  label: { fontFamily: fonts.bold, fontSize: 11 },
  scene: { backgroundColor: colors.background },
};

/** Outline tab icon with a 4px ink dot under it when active. */
export function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: string }) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Ionicons name={name} size={22} color={color} />
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: focused ? colors.text : "transparent" }} />
    </View>
  );
}

/** Center tab: 60px ink circle raised 14px with a white "+" that rotates 90deg on press. The only "+". */
export function TabPlus({ spin = 0, testID }: { spin?: number; testID?: string }) {
  const reduce = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (spin && !reduce) r.value = withTiming(r.value + 90, { duration: 200 });
  }, [spin, reduce, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <View testID={testID} style={[{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: -28 }, shadows.raised]}>
      <Animated.View style={a}>
        <Ionicons name="add" size={26} color={colors.onPrimary} />
      </Animated.View>
    </View>
  );
}
