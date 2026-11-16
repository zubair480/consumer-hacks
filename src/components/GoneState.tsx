import { router } from "expo-router";
import { View } from "react-native";
import { Button, Text } from "./ui";

/** Fallback for item and result screens: shown instead of crashing when the save is gone or a query fails. */
export function GoneState() {
  return (
    <View testID="gone-state" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
      <Text variant="heading">This save is gone.</Text>
      <Button testID="gone-back-button" title="Back to tasks" icon="chevron-back" variant="secondary" onPress={() => router.replace("/")} />
    </View>
  );
}
