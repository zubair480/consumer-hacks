import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { itemTitle } from "../../components/ItemCard";
import { OnboardingSheet } from "../../components/OnboardingSheet";
import { Skeleton } from "../../components/States";
import { metaFor, timeAgo } from "../../components/typeMeta";
import { CountChips, Enter, HeroTypeCard, HoloBand, InkCTA, ItemRow, ScalePressable, SearchPill, SectionTitle, Text, WaveBlock, pastelFor } from "../../components/ui";
import { TAB_BAR_SPACE, useTabBarScroll } from "../../components/ui/InkTabBar";
import { MarkerTitle } from "../../components/ui/MarkerTitle";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import { interestColor, useProfile } from "../../lib/useProfile";
import type { ContentType } from "../../shared/contracts";
import { colors, fonts, gradients, palette } from "../../theme";

const INK2 = "#5B5B63";
const CARD = 300;
const CARD_GAP = 12;

const openImport = () => router.push("/import");
const openLibrary = () => router.push("/library");
const openSearch = () => router.push({ pathname: "/library", params: { focus: "search" } });
const openItem = (id: string) => router.push({ pathname: "/item/[id]", params: { id } });
const openExample = (example: string) => router.push({ pathname: "/capture", params: { example } });

const STARTERS: { key: string; label: string; eyebrow: string; type: ContentType }[] = [
  { key: "scholarship", label: "A scholarship", eyebrow: "CHECK IF YOU QUALIFY", type: "scholarship" },
  { key: "github", label: "A GitHub repo", eyebrow: "GET A SETUP GUIDE", type: "github_repository" },
  { key: "restaurant", label: "A restaurant", eyebrow: "PLAN THE VISIT", type: "restaurant" },
];

const ACTION_LABEL: Partial<Record<ContentType, string>> = {
  scholarship: "Check eligibility",
  github_repository: "Get a setup guide",
  restaurant: "Plan the visit",
};

type Items = NonNullable<ReturnType<typeof useOwnedQuery<typeof api.items.list>>>;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const items = useOwnedQuery(api.items.list, { limit: 50 });
  const me = useProfile();
  const scroll = useTabBarScroll();
  const name = me?.displayName ?? "there";
  const ready = items?.filter((i) => i.extractionStatus === "ready").length ?? 0;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HoloBand height={140} />
      <ScrollView {...scroll} contentContainerStyle={styles.content} testID="home-screen" showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: colors.text }} numberOfLines={1}>
                {greeting()}, {name}
              </Text>
              <Text testID="home-subline" style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: INK2 }}>
                {items === undefined ? " " : ready > 0 ? `${ready} ${ready === 1 ? "save" : "saves"} ready to act on` : "Nothing waiting. Save something new"}
              </Text>
            </View>
            <ScalePressable testID="home-avatar" accessibilityRole="button" accessibilityLabel="Profile" scaleTo={0.97} onPress={() => router.push("/profile")}>
              <LinearGradient colors={gradients.holo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                <View style={[styles.avatar, { backgroundColor: interestColor(me?.topInterest) }]}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.text }}>{(me?.displayName ?? "Z").charAt(0).toUpperCase()}</Text>
                </View>
              </LinearGradient>
            </ScalePressable>
          </View>
        </Enter>
        <Enter index={1}>
          <MarkerTitle lines={["Turn saves", "into action"]} marker="action" />
        </Enter>
        <Enter index={2}>
          <ScalePressable testID="home-search-pill" accessibilityRole="search" accessibilityLabel="Search your saves" scaleTo={0.97} onPress={openSearch}>
            <View pointerEvents="none">
              <SearchPill editable={false} placeholder="Search your saves" />
            </View>
          </ScalePressable>
        </Enter>
        <Boundary title="Couldn’t load your saves">
          <Feed items={items} />
        </Boundary>
      </ScrollView>
      <OnboardingSheet visible={me !== undefined && !me.onboarded} />
    </SafeAreaView>
  );
}

function Feed({ items }: { items: Items | undefined }) {
  if (items === undefined) return <Skeleton rows={3} />;
  if (items.length === 0) {
    return (
      <>
        <Enter index={3}>
          <InkCTA testID="home-empty-import-button" title="Import your X bookmarks" subtitle="Zapy turns each post into something to do" onPress={openImport} />
        </Enter>
        <Enter index={4} style={styles.section}>
          <SectionTitle title="Try one" />
          <View>
            {STARTERS.map((s, i) => (
              <View key={s.key} style={{ marginTop: i === 0 ? 0 : -14, zIndex: i }}>
                <WaveBlock
                  testID={i === 0 ? "home-empty-save-button" : `home-example-${s.key}`}
                  label={s.label}
                  eyebrow={s.eyebrow}
                  color={pastelFor(s.type)}
                  last={i === STARTERS.length - 1}
                  onPress={() => openExample(s.key)}
                  right={
                    <View style={styles.blockArrow}>
                      <Ionicons name="arrow-forward" size={20} color={colors.onPrimary} />
                    </View>
                  }
                />
              </View>
            ))}
          </View>
        </Enter>
      </>
    );
  }
  const counts = new Map<ContentType, number>();
  for (const i of items) if (i.primaryType) counts.set(i.primaryType, (counts.get(i.primaryType) ?? 0) + 1);
  return (
    <>
      <Enter index={3}>
        <CountChips
          chips={[
            { key: "all", label: "All", count: items.length, testID: "home-type-chip-all" },
            ...[...counts.entries()].map(([t, n]) => ({ key: t, label: metaFor(t).label, count: n, type: t, selected: false, testID: `home-type-chip-${t}` })),
          ]}
          onPress={openLibrary}
        />
      </Enter>
      <Boundary fallback={null}>
        <Ready items={items} />
      </Boundary>
      <Enter index={5} style={styles.section}>
        <SectionTitle title="Recently saved" onAction={openLibrary} actionTestID="home-see-all" />
        <View style={{ gap: 10 }}>
          {items.slice(0, 10).map((item, i) => (
            <Enter key={item._id} index={6 + i}>
              <ItemRow
                testID={`item-card-${item._id}`}
                type={item.primaryType}
                title={itemTitle(item)}
                meta={[item.extractionStatus === "ready" ? metaFor(item.primaryType).label : "Reading…", timeAgo(item.createdAt)].join(" · ")}
                status={item.extractionStatus === "ready" ? "ready" : item.extractionStatus === "failed" ? "failed" : "working"}
                onPress={() => openItem(item._id)}
              />
            </Enter>
          ))}
        </View>
      </Enter>
      <InkCTA testID="home-import-button" title="Import your X bookmarks" subtitle="Zapy turns each post into something to do" onPress={openImport} />
      <Boundary fallback={null}>
        <Completed />
      </Boundary>
    </>
  );
}

function Ready({ items }: { items: Items }) {
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 50 });
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  if (outcomes === undefined) return null;
  const acted = new Set(outcomes.map((o) => o.itemId as string));
  const ready = items.filter((i) => i.extractionStatus === "ready" && !acted.has(i._id)).slice(0, 5);
  if (ready.length === 0) return null;
  const card = (item: Items[number], width: number | "100%") => (
    <HeroTypeCard
      testID={`item-card-${item._id}`}
      type={item.primaryType}
      typeLabel={metaFor(item.primaryType).label}
      title={itemTitle(item)}
      source={item.sourceUrl ?? undefined}
      age={timeAgo(item.createdAt)}
      actionLabel={(item.primaryType && ACTION_LABEL[item.primaryType]) ?? "See 3 actions"}
      width={width}
      onPress={() => openItem(item._id)}
    />
  );
  return (
    <Enter index={4} style={styles.section}>
      <SectionTitle title="Ready for you" />
      {ready.length === 1 ? (
        <View testID="home-ready-list">{card(ready[0], "100%")}</View>
      ) : (
        <Animated.ScrollView
          testID="home-ready-list"
          horizontal
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD + CARD_GAP}
          decelerationRate="fast"
          style={styles.bleed}
          contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: 20 }}
        >
          {ready.map((item, i) => (
            <Focus key={item._id} index={i} x={x}>
              {card(item, CARD)}
            </Focus>
          ))}
        </Animated.ScrollView>
      )}
    </Enter>
  );
}

function Focus({ index, x, children }: { index: number; x: SharedValue<number>; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const a = useAnimatedStyle(() => {
    const at = index * (CARD + CARD_GAP);
    const range = [at - CARD - CARD_GAP, at, at + CARD + CARD_GAP];
    return { opacity: interpolate(x.value, range, [0.6, 1, 0.6], "clamp"), transform: [{ scale: reduce ? 1 : interpolate(x.value, range, [0.92, 1, 0.92], "clamp") }] };
  });
  return <Animated.View style={a}>{children}</Animated.View>;
}

function Completed() {
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 5 });
  if (!outcomes?.length) return null;
  return (
    <View style={styles.section}>
      <SectionTitle title="Completed" />
      <View style={{ gap: 10 }}>
        {outcomes.map((r) => (
          <ScalePressable key={r._id} testID={`outcome-${r._id}`} accessibilityRole="button" accessibilityLabel={r.result.title} scaleTo={0.97} onPress={() => router.push({ pathname: "/result/[id]", params: { id: r.executionId } })} style={styles.done}>
            <View style={styles.check}>
              <Ionicons name="checkmark" size={18} color={colors.text} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text }} numberOfLines={1}>
                {r.result.title}
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.text }} numberOfLines={1}>
                {r.itemTitle ? `Opened from ${r.itemTitle}` : timeAgo(r.createdAt)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9A9AA3" />
          </ScalePressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 28, paddingBottom: TAB_BAR_SPACE },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  ring: { width: 48, height: 48, borderRadius: 24, padding: 2 },
  avatar: { flex: 1, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bleed: { marginHorizontal: -20 },
  section: { gap: 12 },
  blockArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  done: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 20, backgroundColor: palette.mint + "80" },
  check: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.mint, borderWidth: 2, borderColor: colors.text, alignItems: "center", justifyContent: "center" },
});
