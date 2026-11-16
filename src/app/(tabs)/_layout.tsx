import { Tabs } from "expo-router/js-tabs";
import { api } from "../../../convex/_generated/api";
import { InkTabBar, TabBarScrollProvider } from "../../components/ui/InkTabBar";
import { colors } from "../../components/tokens";
import { useOwnedQuery } from "../../identity/OwnerProvider";

const tab = (title: string, testID: string) => ({ title, tabBarButtonTestID: testID, tabBarAccessibilityLabel: title });

export default function TabsLayout() {
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 1 });
  return (
    <TabBarScrollProvider>
      <Tabs
        tabBar={(props) => <InkTabBar {...props} latestResultAt={outcomes?.[0]?.createdAt} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="index" options={tab("Home", "tab-home")} />
        <Tabs.Screen name="library" options={{ ...tab("Library", "tab-library"), href: null }} />
        <Tabs.Screen name="create" options={{ ...tab("Save something", "tab-create"), href: null }} />
        <Tabs.Screen name="activity" options={{ ...tab("Activity", "tab-activity"), href: null }} />
        <Tabs.Screen name="profile" options={tab("Profile", "tab-profile")} />
      </Tabs>
    </TabBarScrollProvider>
  );
}
