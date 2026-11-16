import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { ZapMark } from "../components/brand/ZapMark";
import { HoloBand, ScalePressable, Text } from "../components/ui";
import { useOwnedMutation } from "../identity/OwnerProvider";
import { colors, fonts, palette } from "../theme";

/** First-launch welcome (demo flow A1). Pull everything or skip; either marks the profile as onboarded. */
export default function Welcome() {
  const upsert = useOwnedMutation(api.preferences.upsert);
  const leave = (to: "/pull" | "/") => {
    upsert({}).catch(() => {});
    router.replace(to);
  };
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="welcome-screen">
      <HoloBand height={140} />
      <View style={styles.center}>
        <ZapMark size={96} />
        <Text style={styles.title}>Hello, welcome to Zapy.</Text>
        <Text style={styles.sub}>Pull in everything you’ve saved. Zapy turns it into tasks it can do for you.</Text>
      </View>
      <View style={styles.bottom}>
        <ScalePressable testID="welcome-pull-button" accessibilityRole="button" accessibilityLabel="Pull everything" haptic scaleTo={0.97} onPress={() => leave("/pull")} style={styles.primary}>
          <Ionicons name="cloud-download-outline" size={20} color={colors.onPrimary} />
          <Text style={styles.primaryText}>Pull everything</Text>
        </ScalePressable>
        <Pressable testID="welcome-skip-button" accessibilityRole="button" accessibilityLabel="Skip for now" hitSlop={8} onPress={() => leave("/")} style={styles.skip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 20 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, letterSpacing: -0.5, color: colors.text, textAlign: "center" },
  sub: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: palette.text2, textAlign: "center", maxWidth: 300 },
  bottom: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  primary: { height: 56, borderRadius: 999, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.onPrimary },
  skip: { height: 44, alignItems: "center", justifyContent: "center" },
  skipText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.text },
});
