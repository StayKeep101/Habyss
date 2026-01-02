import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BarChart, LineChart } from 'react-native-gifted-charts';

// Mock Profile Image
const PROFILE_IMAGE = 'https://i.pravatar.cc/150?img=11';

// Mock Data
const BLOOD_PRESSURE_DATA = [
  { value: 110, dataPointText: '110' },
  { value: 120, dataPointText: '120' },
  { value: 115, dataPointText: '115' },
  { value: 125, dataPointText: '125' },
  { value: 118, dataPointText: '118' },
  { value: 122, dataPointText: '122' },
  { value: 117, dataPointText: '117' },
];

const BLOOD_PRESSURE_DATA_2 = [
  { value: 70 },
  { value: 75 },
  { value: 72 },
  { value: 78 },
  { value: 74 },
  { value: 76 },
  { value: 73 },
];

const HEART_RATE_DATA = [
  { value: 50, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 80, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 60, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 90, frontColor: '#A3E635' }, // Highlight
  { value: 70, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 65, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 85, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 55, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 75, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 60, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 95, frontColor: '#A3E635' }, // Highlight
  { value: 70, frontColor: 'rgba(255,255,255,0.1)' },
  { value: 65, frontColor: 'rgba(255,255,255,0.1)' },
];

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { width } = Dimensions.get('window');
  const GAP = 12;
  const PADDING = 20;
  const TOTAL_WIDTH = width - (PADDING * 2);
  const HALF_WIDTH = (TOTAL_WIDTH - GAP) / 2;

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 20 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20 }}>
            <TouchableOpacity style={{ padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 24 }}>
              <Image
                source={{ uri: PROFILE_IMAGE }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push('/create')}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sparkles" size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications" size={20} color="#fff" />
                <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#000' }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero: Progress */}
          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 16, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>Your plan is</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 16, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>almost done</Text>
                <Text style={{ fontSize: 32, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>75%</Text>
              </View>
            </View>

            <View style={{ height: 48, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 4, flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              {/* Segmented Progress Gradient */}
              <LinearGradient
                colors={['#2DD4BF', '#A3E635']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 0.75, height: '100%', borderRadius: 20, overflow: 'hidden' }}
              >
                {/* Texture Overlay for segments */}
                <View style={{ flexDirection: 'row', flex: 1 }}>
                  {[...Array(30)].map((_, i) => (
                    <View key={i} style={{ flex: 1, borderRightWidth: 2, borderRightColor: 'rgba(0,0,0,0.2)', transform: [{ skewX: '-20deg' }] }} />
                  ))}
                </View>
              </LinearGradient>
              {/* Remaining Dark Segments */}
              <View style={{ flex: 0.25, height: '100%', borderRadius: 20, overflow: 'hidden', marginLeft: 4, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <View style={{ flexDirection: 'row', flex: 1 }}>
                  {[...Array(10)].map((_, i) => (
                    <View key={i} style={{ flex: 1, borderRightWidth: 2, borderRightColor: 'rgba(255,255,255,0.05)', transform: [{ skewX: '-20deg' }] }} />
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Row 1: Large Tile (Calories) */}
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <VoidCard style={{ padding: 20, height: 120, marginBottom: GAP, justifyContent: 'space-between' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={{ fontSize: 32, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>346</Text>
                  <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', fontFamily: 'SpaceGrotesk-Bold' }}>/2347</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'SpaceMono-Regular', fontSize: 12 }}>Calories - Today</Text>
              </View>

              <View style={{ position: 'absolute', right: 20, top: 32 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderColor: '#F97316', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="flame" size={24} color="#F97316" />
                  <View style={{ position: 'absolute', bottom: -12, backgroundColor: '#000', paddingHorizontal: 4 }}>
                    <Text style={{ color: '#F97316', fontSize: 10, fontWeight: 'bold' }}>REAL</Text>
                  </View>
                </View>
              </View>
            </VoidCard>
          </Animated.View>

          {/* Row 2: Split Tiles */}
          <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
            {/* Green Tile (Nutrition) */}
            <Animated.View entering={FadeInDown.delay(300).duration(600)}>
              <LinearGradient
                colors={['#2DD4BF', '#10B981']}
                style={{ width: HALF_WIDTH, height: 160, borderRadius: 24, padding: 16, justifyContent: 'space-between' }}
              >
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 24, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>125</Text>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginLeft: 4, fontFamily: 'SpaceMono-Regular' }}>mg</Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'SpaceMono-Regular', fontSize: 12 }}>Nutation</Text>
                </View>

                {/* Simple Bar Chart Simulation */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 4, justifyContent: 'space-between' }}>
                  {[0.3, 0.5, 0.4, 0.8, 0.3, 0.6, 0.5, 1.0, 0.7].map((h, i) => (
                    <View key={i} style={{ width: 4, backgroundColor: i === 7 ? '#fff' : 'rgba(255,255,255,0.3)', height: `${h * 80}%`, borderRadius: 2 }} />
                  ))}
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Graph Tile (Blood Pressure) */}
            <Animated.View entering={FadeInDown.delay(400).duration(600)}>
              <VoidCard style={{ width: HALF_WIDTH, height: 160, padding: 16, justifyContent: 'space-between' }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 24, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>117</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 4, fontFamily: 'SpaceMono-Regular' }}>mmHg</Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'SpaceMono-Regular', fontSize: 12 }}>Blood pressure</Text>
                </View>

                {/* Wave Graph */}
                <View style={{ height: 60, marginLeft: -10, marginBottom: -10 }}>
                  <LineChart
                    data={BLOOD_PRESSURE_DATA}
                    data2={BLOOD_PRESSURE_DATA_2}
                    hideRules
                    hideAxesAndRules
                    hideDataPoints
                    curved
                    color="#A3E635"
                    color2="#2DD4BF"
                    thickness={2}
                    thickness2={2}
                    height={60}
                    width={HALF_WIDTH - 20}
                    initialSpacing={0}
                  />
                </View>
              </VoidCard>
            </Animated.View>
          </View>

          {/* Bottom: Heart Rate Analysis */}
          <Animated.View entering={FadeInDown.delay(500).duration(600)}>
            <VoidCard style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 16, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>Heart rate analysis</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginRight: 4 }}>Today</Text>
                  <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.8)" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4 }}>Light</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 20, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>149</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 2 }}>bpm</Text>
                  </View>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4 }}>Intensive</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 20, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>45</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 2 }}>bpm</Text>
                  </View>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4 }}>Anaerobic</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 20, color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>82</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 2 }}>bpm</Text>
                  </View>
                </View>
              </View>

              {/* Bar Chart Bottom */}
              <View style={{ height: 100 }}>
                <BarChart
                  data={HEART_RATE_DATA}
                  barWidth={6}
                  spacing={14}
                  roundedTop
                  roundedBottom
                  hideRules
                  hideAxesAndRules
                  height={80}
                  width={TOTAL_WIDTH - 60}
                  initialSpacing={10}
                  className="self-center"
                />
              </View>

            </VoidCard>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </VoidShell>
  );
};

export default Home;
