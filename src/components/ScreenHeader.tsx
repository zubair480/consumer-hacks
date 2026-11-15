import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Tap } from "./Pressable";
import { colors, space, type } from "./tokens";

export function ScreenHeader({ title, back, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      {back ? (
        <Tap testID="back-button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Tap>
      ) : null}
      <Text style={[back ? type.title : type.display, styles.title]} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  title: { flex: 1 },
});
