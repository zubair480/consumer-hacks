import { ConvexProvider, ConvexReactClient } from "convex/react";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../components/tokens";
import { OwnerProvider } from "../identity/OwnerProvider";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text, border: colors.border } };

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <OwnerProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="capture" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          </Stack>
        </OwnerProvider>
      </ThemeProvider>
    </ConvexProvider>
  );
}
