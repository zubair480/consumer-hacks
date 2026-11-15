import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Boundary } from "../Boundary";
import { Tap } from "../Pressable";
import { Section } from "../Section";
import { colors, space } from "../tokens";
import { palette } from "../../theme";
import { DisplayTitle, HeroTypeCard, HoloBand, InkPill } from "../ui";
import { studioText } from "./studioStyles";
import { api } from "../../../convex/_generated/api";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import { Skeleton } from "../States";
import { RecentDrafts } from "./RecentDrafts";
import { SourceRow } from "./SourceRow";

export default function StudioHome() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HoloBand height={140} />
      <ScrollView contentContainerStyle={styles.content} testID="studio-home-screen">
        <View style={styles.header}>
          <InkPill label="Create" />
          <DisplayTitle highlight="posts" highlightColor={palette.lavender} size={34}>{"Turn saves into posts"}</DisplayTitle>
          <Text style={studioText.body}>Turn a save or a new photo into posts for each platform. You edit, copy and share. Nothing is posted for you.</Text>
        </View>
        <HeroTypeCard
          testID="studio-from-save"
          runTestID="studio-from-save-pick"
          type="tutorial"
          typeLabel="From a save"
          title="Drafts from your Library"
          avatars={["in", "X", "IG"]}
          actionLabel="Pick a save"
          onPress={() => router.push("/studio/source")}
        />
        <HeroTypeCard
          testID="studio-new-photo"
          runTestID="studio-new-photo-pick"
          type="graphic"
          typeLabel="New photo"
          title="Caption or video script"
          avatars={["IG", "TT"]}
          actionLabel="Take or pick a photo"
          onPress={() => router.push("/studio/photo")}
        />
        <Boundary fallback={null}>
          <RecentDrafts />
        </Boundary>
        <Boundary title="Couldn’t load your saves">
          <RecentSaves />
        </Boundary>
      </ScrollView>
    </SafeAreaView>
  );
}

function RecentSaves() {
  const items = useOwnedQuery(api.items.list, { limit: 30 });
  if (items === undefined) return <Skeleton rows={2} height={72} />;
  const ready = items.filter((i) => i.extractionStatus === "ready").slice(0, 4);
  if (ready.length === 0) return null;
  return (
    <Section title="Recent saves" right={<Tap testID="studio-see-all-saves" accessibilityRole="button" onPress={() => router.push("/studio/source")} style={styles.linkTap}><Text style={styles.link}>See all</Text></Tap>}>
      {ready.map((item) => <SourceRow key={item._id} item={item} onPress={() => router.push({ pathname: "/studio/platforms", params: { itemId: item._id } })} />)}
    </Section>
  );
}

const styles = StyleSheet.create({
  link: { ...studioText.callout, textDecorationLine: "underline" },
  linkTap: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
  header: { gap: space.md, marginBottom: space.lg },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.md, paddingBottom: 120 },
});
