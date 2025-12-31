import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  loading?: boolean;
}

const FEATURES = [
  { icon: 'infinite', title: 'Unlimited Habits', description: 'Track as many habits as you want' },
  { icon: 'analytics', title: 'Advanced Analytics', description: 'Deep dive into your progress and patterns' },
  { icon: 'sync', title: 'Multi-device Sync', description: 'Access your data everywhere instantly' },
  { icon: 'download', title: 'Data Export', description: 'Export your habit data in CSV/JSON' },
  { icon: 'bulb', title: 'AI Coaching', description: 'Personalized advice from our AI mentor' },
];

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, onClose, onSubscribe, loading }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        
        <Animated.View 
          entering={SlideInDown.springify().damping(15)}
          style={styles.content}
        >
          <LinearGradient
            colors={['#1a1a1a', '#0a0a0a']}
            style={styles.gradient}
          >
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <Ionicons name="star" size={40} color="#FFD700" />
                </View>
                <Text style={styles.title}>Habyss Premium</Text>
                <Text style={styles.subtitle}>Unlock your full potential with advanced features</Text>
              </View>

              <View style={styles.featuresList}>
                {FEATURES.map((feature, index) => (
                  <Animated.View 
                    key={index}
                    entering={FadeIn.delay(index * 100)}
                    style={styles.featureItem}
                  >
                    <View style={styles.featureIcon}>
                      <Ionicons name={feature.icon as any} size={24} color="#007AFF" />
                    </View>
                    <View style={styles.featureText}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>

              <View style={styles.pricingContainer}>
                <Text style={styles.price}>$4.99</Text>
                <Text style={styles.period}>/month</Text>
              </View>

              <TouchableOpacity 
                style={[styles.subscribeButton, loading && styles.disabledButton]} 
                onPress={onSubscribe}
                disabled={loading}
              >
                <Text style={styles.subscribeText}>
                  {loading ? 'Redirecting...' : 'Upgrade Now'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.restoreButton}>
                <Text style={styles.restoreText}>Restore Purchase</Text>
              </TouchableOpacity>
              
              <Text style={styles.footerText}>
                Cancel anytime. Payment will be charged to your account.
              </Text>
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    height: '85%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    padding: 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  featuresList: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    color: '#888',
  },
  pricingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  period: {
    fontSize: 18,
    color: '#aaa',
    marginLeft: 4,
  },
  subscribeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  subscribeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  restoreText: {
    color: '#666',
    fontSize: 14,
  },
  footerText: {
    textAlign: 'center',
    color: '#444',
    fontSize: 12,
  },
});
