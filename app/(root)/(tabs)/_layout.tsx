import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Home from './home';
import Create from './create';
import Stats from './stats';
import Social from './social';
import More from './more';

const Tab = createBottomTabNavigator();

const TabsLayout = () => {
  return (
    
    <SafeAreaProvider>
      <Tab.Navigator 
        screenOptions={({ route }) => ({ 
          headerShown: false,
          tabBarShowLabel:false,
          tabBarIconStyle: {
            marginTop: 12, // Adjust this value to lower the icons
          },
          tabBarStyle: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: 'black',
            position: 'absolute',
            zIndex: 1,
            height: 60,
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'home';

            if (route.name === 'Home') {
              iconName = focused ? 'calendar-number' : 'calendar-number-outline';
              size = 28
            } else if (route.name === 'Create') {
              iconName = focused ? 'add-circle' : 'add-circle-outline';
              size = 30
            } else if (route.name === 'Social') {
              iconName = focused ? 'people' : 'people-outline';
              size = 30
            } else if (route.name === 'Stats') {
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
              size = 28
            } else if (route.name === 'More') {
              iconName = focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline';
              size = 30
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={Home} />
        <Tab.Screen name="Social" component={Social} />
        <Tab.Screen name="Create" component={Create} />
        <Tab.Screen name="Stats" component={Stats} />
        <Tab.Screen name="More" component={More} />
      </Tab.Navigator>
    </SafeAreaProvider>
  );
};

export default TabsLayout;