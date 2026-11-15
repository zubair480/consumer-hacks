import { StyleSheet, Text, View } from "react-native";
import { space, type } from "./tokens";

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={type.label}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
