import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { itemTitle } from "../../components/ItemCard";
import { Skeleton } from "../../components/States";
import { metaFor, timeAgo } from "../../components/typeMeta";
import { CountChips, Enter, HeroTypeCard, HoloBand, HomeHeader, InkCTA, ItemRow, ScalePressable, ScreenTitle, SearchPill, SectionTitle, SlideUp, WaveBlock, pastelFor } from "../../components/ui";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import type { ContentType } from "../../shared/contracts";
import { colors, palette, spacing } from "../../theme";

const openImport = () => router.push("/import");
const openLibrary = () => router.push("/library");
const openItem = (id: string) => router.push({ pathname: "/item/[id]", params: { id } });
const openExample = (example: string) => router.push({ pathname: "/capture", params: { example } });

type Items = NonNullable<ReturnType<typeof useOwnedQuery<typeof api.items.list>>>;

const CARD_WIDTH = 300;
const CARD_GAP = 12;

const STARTERS = [
  { key: "scholarship", label: "A scholarship", eyebrow: "Get a checklist", color: palette.butter, testID: "home-empty-save-button" },
  { key: "github", label: "A GitHub repo", eyebrow: "Get a setup guide", color: palette.lavender, testID: "home-example-github" },
  { key: "restaurant", label: "A restaurant", eyebrow: "Plan a visit", color: palette.peach, testID: "home-example-restaurant" },
];

export default function Home() {
  const items = useOwnedQuery(api.items.list, { limit: 50 });
  const profile = useOwnedQuery(api.preferences.get, {});
  const name = (profile as { name?: string } | null | undefined)?.name?.trim() || "there";
  const ready = items?.filter((i) => i.extractionStatus === "ready").length;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HoloBand height={160} />
      <ScrollView contentContainerStyle={styles.content} testID="home-screen" showsVerticalScrollIndicator={false}>
        <Enter index={0}>
          <HomeHeader name={name} saves={items?.length} ready={ready} onAvatarPress={() => router.push("/profile")} />
        </Enter>
        <Enter index={1}>
          <ScreenTitle>Your saves, ready to act.</ScreenTitle>
        </Enter>
        <Enter index={2}>
          <ScalePressable testID="home-search-pill" accessibilityRole="search" accessibilityLabel="Search your saves" onPress={openLibrary} scaleTo={0.98}>
            <View pointerEvents="none">
              <SearchPill editable={false} placeholder="Search your saves" onFilterPress={openLibrary} />
            </View>
          </ScalePressable>
        </Enter>
        <Boundary title="Couldn’t load your saves">
          <Feed items={items} />
        </Boundary>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feed({ items }: { items: Items | undefined }) {
  if (items === undefined) return <Skeleton rows={3} />;
  if (items.length === 0) {
    return (
      <>
        <Enter index={3}>
          <View testID="home-import-button">
            <InkCTA testID="home-empty-import-button" title="Import your X bookmarks" subtitle="Pull in what you already saved" onPress={openImport} />
          </View>
        </Enter>
        <Enter index={4} style={styles.section}>
          <SectionTitle title="Try one" />
          <View>
            {STARTERS.map((s, i) => (
              <SlideUp key={s.key} index={i} style={{ marginTop: i === 0 ? 0 : -14, zIndex: i }}>
                <WaveBlock
                  testID={s.testID}
                  label={s.label}
                  eyebrow={s.eyebrow}
                  color={s.color}
                  last={i === STARTERS.length - 1}
                  onPress={() => openExample(s.key)}
                  right={
                    <View style={styles.arrow}>
                      <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
                    </View>
                  }
                />
              </SlideUp>
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
      {counts.size > 0 ? (
        <Enter index={3}>
          <CountChips
            chips={[
              { key: "all", label: "All", count: items.length, testID: "home-type-chip-all" },
              ...[...counts.entries()].map(([t, n]) => ({ key: t, label: metaFor(t).label, count: n, type: t, selected: false, testID: `home-type-chip-${t}` })),
            ]}
            onPress={openLibrary}
          />
        </Enter>
      ) : null}
      <Boundary fallback={null}>
        <ReadyAndOutcomes items={items} />
      </Boundary>
      <Enter index={6}>
        <InkCTA testID="home-import-button" title="Import your X bookmarks" subtitle="Pull in what you already saved" onPress={openImport} />
      </Enter>
      <View style={styles.section}>
        <Enter index={7}>
          <SectionTitle title="Recently saved" onAction={openLibrary} actionTestID="home-see-all" />
        </Enter>
        {items.slice(0, 10).map((item, i) => (
          <Enter key={item._id} index={8 + i}>
            <ItemRow
              testID={`item-card-${item._id}`}
              type={item.primaryType ?? undefined}
              title={itemTitle(item)}
              meta={[item.extractionStatus === "ready" ? metaFor(item.primaryType).label : "Reading…", timeAgo(item.createdAt)].join(" · ")}
              status={item.extractionStatus === "ready" ? "ready" : item.extractionStatus === "failed" ? "failed" : "working"}
              onPress={() => openItem(item._id)}
            />
          </Enter>
        ))}
      </View>
    </>
  );
}

function ReadyAndOutcomes({ items }: { items: Items }) {
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 50 });
  if (outcomes === undefined) return null;
  const acted = new Set(outcomes.map((o) => o.itemId as string));
  const ready = items.filter((i) => i.extractionStatus === "ready" && !acted.has(i._id)).slice(0, 5);
  return (
    <>
      {ready.length > 0 ? (
        <Enter index={4} style={styles.section}>
          <SectionTitle title="Ready for you" />
          <FlatList
            testID="home-ready-list"
            horizontal
            data={ready}
            keyExtractor={(i) => i._id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            style={styles.bleed}
            contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: spacing.xl }}
            renderItem={({ item }) => (
              <HeroTypeCard
                testID={`item-card-${item._id}`}
                width={ready.length > 1 ? CARD_WIDTH : 353}
                type={item.primaryType ?? undefined}
                typeLabel={metaFor(item.primaryType).label}
                title={itemTitle(item)}
                source={item.sourceUrl?.replace(/^https?:\/\/(www\.)?/, "") ?? undefined}
                actionLabel="See 3 actions"
                onPress={() => openItem(item._id)}
              />
            )}
          />
        </Enter>
      ) : null}
      {outcomes.length > 0 ? (
        <Enter index={5} style={styles.section}>
          <SectionTitle title="Done" />
          {outcomes.slice(0, 5).map((r) => (
            <ItemRow
              key={r._id}
              testID={`outcome-${r._id}`}
              type={r.itemPrimaryType ?? undefined}
              title={r.result.title}
              meta={[r.itemTitle, timeAgo(r.createdAt)].filter(Boolean).join(" · ")}
              right={
                <View style={[styles.check, { backgroundColor: pastelFor(r.itemPrimaryType ?? undefined) }]}>
                  <Ionicons name="checkmark" size={16} color={colors.text} />
                </View>
              }
              onPress={() => router.push({ pathname: "/result/[id]", params: { id: r.executionId } })}
            />
          ))}
        </Enter>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.xl, paddingBottom: 140 },
  bleed: { marginHorizontal: -spacing.xl },
  section: { gap: spacing.md },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.text },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
