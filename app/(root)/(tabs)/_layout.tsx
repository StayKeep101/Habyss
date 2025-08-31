import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import Home from './home';
import Create from './create';
import Stats from './stats';
import Social from './social';
import More from './more';

const Tab = createBottomTabNavigator();

const TabsLayout = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaProvider>
      <Tab.Navigator 
        screenOptions={({ route }) => ({ 
          headerShown: false,
          tabBarShowLabel: false,
          tabBarIconStyle: {
            marginTop: 8,
          },
          tabBarStyle: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            position: 'absolute',
            zIndex: 1,
            height: 80,
            paddingBottom: 20,
            paddingTop: 10,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'home';

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
              size = 24;
            } else if (route.name === 'Focus') {
              iconName = focused ? 'timer' : 'timer-outline';
              size = 24;
            } else if (route.name === 'AI') {
              iconName = focused ? 'sparkles' : 'sparkles-outline';
              size = 24;
            } else if (route.name === 'Create') {
              iconName = focused ? 'add-circle' : 'add-circle-outline';
              size = 28;
            } else if (route.name === 'Stats') {
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
              size = 24;
            } else if (route.name === 'More') {
              iconName = focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline';
              size = 24;
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={Home} />
        <Tab.Screen name="Focus" component={require('../focus').default} />
        <Tab.Screen name="AI" component={require('../ai').default} />
        <Tab.Screen name="Create" component={Create} />
        <Tab.Screen name="Stats" component={Stats} />
        <Tab.Screen name="More" component={More} />
      </Tab.Navigator>
    </SafeAreaProvider>
  );
};

export default TabsLayout;