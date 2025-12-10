import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { View, TouchableOpacity } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import CreateModal from '@/components/CreateModal';
import { TabBar, TabBarItem } from '@/components/ui/tab-bar';

import Home from './home';
import Stats from './stats';
import More from './more';

const Tab = createBottomTabNavigator();

function TabBarIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  return <Ionicons size={24} name={name} color={color} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <Home />;
      case 'stats':
        return <Stats />;
      case 'more':
        return <More />;
      default:
        return <Home />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Main Content */}
      <View style={{ flex: 1, paddingBottom: 100 }}>
        {renderScreen()}
      </View>

      {/* Custom Tab Bar with Soft Rounded Edges */}
      <TabBar>
        <TabBarItem
          icon="home"
          label="Home"
          isActive={activeTab === 'home'}
          onPress={() => setActiveTab('home')}
        />
        <TabBarItem
          icon="stats-chart"
          label="Stats"
          isActive={activeTab === 'stats'}
          onPress={() => setActiveTab('stats')}
        />
        <TabBarItem
          icon="ellipsis-horizontal"
          label="More"
          isActive={activeTab === 'more'}
          onPress={() => setActiveTab('more')}
        />
      </TabBar>

      {/* Create Modal */}
      <CreateModal
        visible={isCreateVisible}
        onClose={() => setIsCreateVisible(false)}
        onSelectOption={() => setIsCreateVisible(false)}
      />
    </View>
  );
}