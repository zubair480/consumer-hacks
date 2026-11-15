import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import { PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useFonts } from "expo-font";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { colors } from "../components/tokens";
import { ToastHost } from "../components/ui/Toast";
import { OwnerProvider } from "../identity/OwnerProvider";

SplashScreen.preventAutoHideAsync().catch(() => {});

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text, border: colors.border } };

export default function RootLayout() {
  const [loaded, error] = useFonts({ ArchivoBlack_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  const ready = loaded || !!error;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <ConvexProvider client={convex}>
      <ThemeProvider value={theme}>
        <StatusBar style="dark" />
        <OwnerProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="capture" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          </Stack>
          <ToastHost />
        </OwnerProvider>
      </ThemeProvider>
    </ConvexProvider>
  );
}
