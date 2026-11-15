import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { api } from "../../../convex/_generated/api";
import { InkTabBar, TabBarScrollProvider } from "../../components/ui/InkTabBar";
import { colors } from "../../components/tokens";
import { useOwnedQuery } from "../../identity/OwnerProvider";

const tab = (title: string, testID: string) => ({ title, tabBarButtonTestID: testID, tabBarAccessibilityLabel: title });

export default function TabsLayout() {
  const items = useOwnedQuery(api.items.list, { limit: 50 });
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 1 });
  const captureOpen = usePathname() === "/capture";
  return (
    <TabBarScrollProvider>
      <Tabs
        tabBar={(props) => <InkTabBar {...props} saves={items?.length} latestResultAt={outcomes?.[0]?.createdAt} captureOpen={captureOpen} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
        screenListeners={{ tabPress: () => Haptics.selectionAsync().catch(() => {}) }}
      >
        <Tabs.Screen name="index" options={tab("Home", "tab-home")} />
        <Tabs.Screen name="library" options={tab("Library", "tab-library")} />
        <Tabs.Screen
          name="create"
          options={tab("Save something", "tab-create")}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push("/capture");
            },
          }}
        />
        <Tabs.Screen name="activity" options={tab("Activity", "tab-activity")} />
        <Tabs.Screen name="profile" options={tab("Profile", "tab-profile")} />
      </Tabs>
    </TabBarScrollProvider>
  );
}
