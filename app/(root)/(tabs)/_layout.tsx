import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { View, TouchableOpacity } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import CreateModal from '@/components/CreateModal';

import Home from './home';
import Stats from './stats';
import More from './more';

const Tab = createBottomTabNavigator();

function TabBarIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  return <Ionicons size={24} name={name} color={color} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const currentRouteName = useNavigationState((state) => state?.routes?.[state.index]?.name);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.surfaceSecondary,
            height: 64,
            paddingBottom: 8,
            paddingTop: 2,
          },
          tabBarItemStyle: {
            paddingTop: 0,
            paddingBottom: 0,
          },
          tabBarIconStyle: {
            marginBottom: -4,
          },
          tabBarLabelStyle: {
            marginTop: 2,
            fontSize: 11,
            paddingBottom: 0,
          },
          headerShown: false,
        }}
      >
      <Tab.Screen
        name="home"
        component={Home}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      {/* Create tab between Home and Stats */}
      <Tab.Screen
        name="create"
        component={Home}
        listeners={{
          tabPress: (e) => {
            // prevent navigation and open modal instead
            e.preventDefault();
            setIsCreateVisible(true);
          },
        }}
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <TabBarIcon name="add-circle" color={color} />,
        }}
      />
      <Tab.Screen
        name="stats"
        component={Stats}
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => <TabBarIcon name="stats-chart" color={color} />,
        }}
      />
      <Tab.Screen
        name="more"
        component={More}
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabBarIcon name="ellipsis-horizontal" color={color} />,
        }}
      />
      </Tab.Navigator>

      {/* Modal opened from Create tab */}

      {/* Create Modal */}
      <CreateModal
        visible={isCreateVisible}
        onClose={() => setIsCreateVisible(false)}
        onSelectOption={() => setIsCreateVisible(false)}
      />
    </View>
  );
}