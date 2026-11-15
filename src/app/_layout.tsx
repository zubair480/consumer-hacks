import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { OwnerProvider } from "../identity/OwnerProvider";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <OwnerProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OwnerProvider>
    </ConvexProvider>
  );
}
