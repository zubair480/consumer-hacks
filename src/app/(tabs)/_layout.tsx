import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { TabPlus, tabBarTheme } from "../../components/ui";

type IconName = ComponentProps<typeof Ionicons>["name"];

const tab = (title: string, icon: IconName, testID: string) => ({
  title,
  tabBarButtonTestID: testID,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? icon : (`${icon}-outline` as IconName)} size={23} color={color as string} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabBarTheme.activeTint,
        tabBarInactiveTintColor: tabBarTheme.inactiveTint,
        tabBarStyle: tabBarTheme.style,
        tabBarLabelStyle: tabBarTheme.label,
        sceneStyle: tabBarTheme.scene,
      }}
      screenListeners={{ tabPress: () => Haptics.selectionAsync().catch(() => {}) }}
    >
      <Tabs.Screen name="index" options={tab("Home", "home", "tab-home")} />
      <Tabs.Screen name="library" options={tab("Library", "albums", "tab-library")} />
      <Tabs.Screen name="create" options={{ ...tab("Create", "add", "tab-create"), tabBarLabel: () => null, tabBarIcon: () => <TabPlus /> }} />
      <Tabs.Screen name="activity" options={tab("Activity", "pulse", "tab-activity")} />
      <Tabs.Screen name="profile" options={tab("Profile", "person-circle", "tab-profile")} />
    </Tabs>
  );
}
