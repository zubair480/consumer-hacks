import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Boundary } from "../Boundary";
import { Tap } from "../Pressable";
import { ScreenHeader } from "../ScreenHeader";
import { Section } from "../Section";
import { colors, gradient, radius, space, type } from "../tokens";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../convex/_generated/api";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import { Skeleton } from "../States";
import { RecentDrafts } from "./RecentDrafts";
import { SourceRow } from "./SourceRow";

export default function StudioHome() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} testID="studio-home-screen">
        <ScreenHeader title="Create" />
        <Text style={[type.caption, styles.lede]}>Turn a save or a new photo into posts for each platform. You edit, copy and share; nothing is posted for you.</Text>
        <Tap testID="studio-from-save" accessibilityRole="button" accessibilityLabel="Post from a save" onPress={() => router.push("/studio/source")} haptic="medium">
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="bookmark" size={22} color={colors.text} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={type.title}>From a save</Text>
              <Text style={styles.heroBody}>Pick something from your Library and get LinkedIn, X and more drafts.</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </LinearGradient>
        </Tap>
        <Tap testID="studio-new-photo" accessibilityRole="button" accessibilityLabel="Post from a new photo" onPress={() => router.push("/studio/photo")} style={styles.card}>
          <View style={[styles.heroIcon, { backgroundColor: colors.accentAlt + "22" }]}><Ionicons name="camera" size={22} color={colors.accentAlt} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={type.heading}>New photo</Text>
            <Text style={type.caption}>Shoot or pick a photo for an Instagram caption or a TikTok script.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
        </Tap>
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
    <Section title="Recent saves" right={<Tap testID="studio-see-all-saves" onPress={() => router.push("/studio/source")}><Text style={styles.link}>See all</Text></Tap>}>
      {ready.map((item) => <SourceRow key={item._id} item={item} onPress={() => router.push({ pathname: "/studio/platforms", params: { itemId: item._id } })} />)}
    </Section>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 120 },
  lede: { marginTop: -space.sm },
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.xl, borderRadius: radius.xl },
  heroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroBody: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 19 },
  card: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
