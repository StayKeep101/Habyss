import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface SettingOption {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  comingSoon?: boolean;
}

const SettingsHub = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const settings: { section: string; items: SettingOption[] }[] = [
    {
      section: 'APP PREFERENCES',
      items: [
        { id: 'notifications', icon: 'notifications-outline', title: 'Notifications', subtitle: 'Manage alerts and reminders' },
        { id: 'appearance', icon: 'color-palette-outline', title: 'Appearance', subtitle: 'Theme, colors, and display' },
        { id: 'sounds', icon: 'volume-high-outline', title: 'Sounds & Haptics', subtitle: 'Audio feedback settings' },
      ]
    },
    {
      section: 'DATA & SYNC',
      items: [
        { id: 'backup', icon: 'cloud-upload-outline', title: 'Backup & Restore', subtitle: 'Cloud sync and data export' },
        { id: 'integrations', icon: 'link-outline', title: 'Integrations', subtitle: 'Connect external services' },
        { id: 'widgets', icon: 'apps-outline', title: 'Widgets', subtitle: 'Home screen widgets', comingSoon: true },
      ]
    },
    {
      section: 'ACCOUNT',
      items: [
        { id: 'subscription', icon: 'star-outline', title: 'Subscription', subtitle: 'Manage your plan', onPress: () => router.push('/paywall') },
        { id: 'privacy', icon: 'shield-checkmark-outline', title: 'Privacy & Security', subtitle: 'Data and security options' },
      ]
    },
    {
      section: 'SUPPORT',
      items: [
        { id: 'help', icon: 'help-buoy-outline', title: 'Help Center', subtitle: 'FAQs and guides' },
        { id: 'contact', icon: 'mail-outline', title: 'Contact Support', subtitle: 'Get help from our team' },
        { id: 'about', icon: 'information-circle-outline', title: 'About Habyss', subtitle: 'Version and legal info' },
      ]
    }
  ];

  const handlePress = (item: SettingOption) => {
    Haptics.selectionAsync();
    if (item.comingSoon) {
      // Show coming soon feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (item.onPress) {
      item.onPress();
    }
  };

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Cockpit Header Glow */}
        <LinearGradient
          colors={['rgba(16, 185, 129, 0.1)', 'transparent']}
          style={styles.headerGlow}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Cockpit-style Hero */}
          <View style={styles.heroSection}>
            <BlurView intensity={40} tint="dark" style={styles.heroBlur}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.2)', 'rgba(59, 130, 246, 0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
              >
                <View style={styles.heroIcon}>
                  <Ionicons name="settings" size={28} color="#10B981" />
                </View>
                <Text style={styles.heroTitle}>CONTROL CENTER</Text>
                <Text style={styles.heroSubtitle}>Customize your Habyss experience</Text>
              </LinearGradient>
            </BlurView>
          </View>

          {/* Settings Sections */}
          {settings.map((section, sectionIdx) => (
            <View key={section.section} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
                {section.section}
              </Text>
              <VoidCard style={styles.sectionCard}>
                {section.items.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <TouchableOpacity
                      style={styles.settingItem}
                      onPress={() => handlePress(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconContainer, { borderColor: colors.border }]}>
                        <Ionicons name={item.icon as any} size={20} color={colors.textSecondary} />
                      </View>
                      <View style={styles.itemContent}>
                        <View style={styles.itemHeader}>
                          <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                            {item.title}
                          </Text>
                          {item.comingSoon && (
                            <View style={styles.comingSoonBadge}>
                              <Text style={styles.comingSoonText}>SOON</Text>
                            </View>
                          )}
                        </View>
                        {item.subtitle && (
                          <Text style={[styles.itemSubtitle, { color: colors.textTertiary }]}>
                            {item.subtitle}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                    {idx < section.items.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                  </React.Fragment>
                ))}
              </VoidCard>
            </View>
          ))}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textTertiary }]}>
              "Descend into discipline"
            </Text>
            <Text style={[styles.versionText, { color: colors.textTertiary }]}>
              v1.0.4 • Void Build
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </VoidShell>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk-Bold',
    letterSpacing: 1,
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    zIndex: -1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  heroSection: {
    marginBottom: 24,
  },
  heroBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroGradient: {
    padding: 24,
    alignItems: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 3,
    fontFamily: 'SpaceGrotesk-Bold',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'SpaceMono-Regular',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
    fontFamily: 'SpaceMono-Regular',
  },
  sectionCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'SpaceGrotesk-Bold',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'SpaceMono-Regular',
  },
  comingSoonBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comingSoonText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginLeft: 70,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: 'SpaceMono-Regular',
  },
  versionText: {
    fontSize: 10,
    marginTop: 8,
    fontFamily: 'SpaceMono-Regular',
  },
});

export default SettingsHub;
