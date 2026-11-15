import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { EmptyState } from "./EmptyState";
import { GradientButton } from "./GradientButton";
import { errorMessage } from "./media";
import { colors, radius, space } from "./tokens";

export function Skeleton({ rows = 3, height = 88 }: { rows?: number; height?: number }) {
  const [pulse] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.wrap} testID="loading-skeleton" accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Animated.View key={i} style={[styles.block, { height, opacity: pulse }]} />
      ))}
    </View>
  );
}

export function ErrorState({ title, error, onRetry }: { title?: string; error: unknown; onRetry: () => void }) {
  return (
    <EmptyState icon="cloud-offline-outline" title={title ?? "Couldn’t load this"} body={errorMessage(error)}>
      <GradientButton testID="error-retry-button" label="Try again" icon="refresh" variant="secondary" onPress={onRetry} style={{ alignSelf: "stretch", marginTop: space.sm }} />
    </EmptyState>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  block: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
