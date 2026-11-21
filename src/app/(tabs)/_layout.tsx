import { Tabs } from 'expo-router/tabs';

import { LifeQuestTabBar } from '@/ui/tab-bar';

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <LifeQuestTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="roadmap" options={{ title: 'Roadmap' }} />
      <Tabs.Screen name="quests" options={{ title: 'Quests' }} />
      <Tabs.Screen name="bank" options={{ title: 'Bank' }} />
    </Tabs>
  );
}
