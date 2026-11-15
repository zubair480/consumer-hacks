import type { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useState, type ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { TabIcon, TabPlus, tabBarTheme } from "../../components/ui";

type IconName = ComponentProps<typeof Ionicons>["name"];

const tab = (title: string, icon: IconName, testID: string) => ({
  title,
  tabBarButtonTestID: testID,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => <TabIcon name={icon} focused={focused} color={color as string} />,
});

export default function TabsLayout() {
  const [spin, setSpin] = useState(0);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: tabBarTheme.activeTint,
        tabBarInactiveTintColor: tabBarTheme.inactiveTint,
        tabBarStyle: tabBarTheme.style,
        sceneStyle: tabBarTheme.scene,
      }}
      screenListeners={{ tabPress: () => Haptics.selectionAsync().catch(() => {}) }}
    >
      <Tabs.Screen name="index" options={tab("Home", "home-outline", "tab-home")} />
      <Tabs.Screen name="library" options={tab("Library", "albums-outline", "tab-library")} />
      <Tabs.Screen
        name="create"
        options={{ ...tab("Save something", "add", "tab-create"), tabBarIcon: () => <TabPlus spin={spin} testID="home-save-button" /> }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            setSpin((n) => n + 1);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push("/capture");
          },
        }}
      />
      <Tabs.Screen name="activity" options={tab("Activity", "pulse-outline", "tab-activity")} />
      <Tabs.Screen name="profile" options={tab("Profile", "person-circle-outline", "tab-profile")} />
    </Tabs>
  );
}
