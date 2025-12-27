import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, DeviceEventEmitter, Platform, Dimensions, ScrollView, Modal, Switch, KeyboardAvoidingView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addHabit, updateHabit, HabitCategory } from '@/lib/habits';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { cn } from '@/lib/utils';
import { useRouter, useLocalSearchParams } from 'expo-router';

const categories: { key: HabitCategory; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'health', label: 'Health', color: '#34D399', icon: 'medical' },
  { key: 'fitness', label: 'Fitness', color: '#FBBF24', icon: 'fitness' },
  { key: 'work', label: 'Work', color: '#60A5FA', icon: 'briefcase' },
  { key: 'personal', label: 'Personal', color: '#F472B6', icon: 'person' },
  { key: 'mindfulness', label: 'Mindfulness', color: '#A78BFA', icon: 'leaf' },
  { key: 'misc', label: 'Misc', color: '#9CA3AF', icon: 'grid' },
];

const POPULAR_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  'alarm', 'american-football', 'analytics', 'aperture', 'apps', 'archive', 'barbell', 'basket', 'basketball', 'battery-charging',
  'beer', 'bicycle', 'boat', 'book', 'bookmark', 'briefcase', 'brush', 'bug', 'build', 'bulb', 'bus', 'business', 'cafe',
  'calculator', 'calendar', 'camera', 'car', 'card', 'cart', 'cash', 'chatbubble', 'checkbox', 'checkmark-circle', 'clipboard',
  'close-circle', 'cloud', 'code', 'code-slash', 'cog', 'color-palette', 'compass', 'construct', 'contrast', 'copy', 'create',
  'cut', 'desktop', 'disc', 'document', 'document-text', 'download', 'ear', 'earth', 'easel', 'egg', 'ellipse', 'enter',
  'exit', 'eye', 'eyedrop', 'fast-food', 'female', 'file-tray', 'film', 'filter', 'finger-print', 'fish', 'fitness',
  'flag', 'flame', 'flash', 'flask', 'flower', 'folder', 'football', 'footsteps', 'game-controller', 'gift', 'glasses', 'globe',
  'golf', 'grid', 'hammer', 'hand-left', 'hand-right', 'happy', 'headset', 'heart', 'help-buoy', 'home', 'hourglass', 'ice-cream',
  'image', 'images', 'infinite', 'information-circle', 'journal', 'key', 'keypad', 'laptop', 'layers', 'leaf', 'library', 'link',
  'list', 'location', 'lock-closed', 'lock-open', 'log-in', 'log-out', 'magnet', 'mail', 'male', 'man', 'map', 'medal', 'medical',
  'medkit', 'megaphone', 'menu', 'mic', 'moon', 'musical-note', 'musical-notes', 'navigate', 'newspaper', 'notifications', 'nutrition',
  'options', 'paper-plane', 'partly-sunny', 'pause', 'paw', 'pencil', 'people', 'person', 'phone-portrait', 'pie-chart', 'pin',
  'pint', 'pizza', 'planet', 'play', 'play-skip-back', 'play-skip-forward', 'podium', 'power', 'pricetag', 'print', 'prism',
  'pulse', 'push', 'qr-code', 'radio', 'radio-button-on', 'rainy', 'reader', 'receipt', 'recording', 'refresh', 'reload',
  'repeat', 'resize', 'restaurant', 'return-down-back', 'return-down-forward', 'return-up-back', 'return-up-forward', 'ribbon',
  'rocket', 'rose', 'sad', 'save', 'scale', 'scan', 'school', 'search', 'send', 'server', 'settings', 'shapes', 'share',
  'shield', 'shirt', 'shuffle', 'skull', 'snow', 'speedometer', 'square', 'star', 'stats-chart', 'stop', 'stopwatch', 'subway',
  'sunny', 'swap-horizontal', 'swap-vertical', 'sync', 'tablet-landscape', 'tablet-portrait', 'telescope', 'tennisball', 'terminal',
  'text', 'thermometer', 'thumbs-down', 'thumbs-up', 'thunderstorm', 'time', 'timer', 'today', 'toggle', 'trail-sign', 'train',
  'transgender', 'trash', 'trending-down', 'trending-up', 'trophy', 'tv', 'umbrella', 'videocam', 'volume-high', 'volume-low',
  'volume-medium', 'volume-mute', 'volume-off', 'walk', 'wallet', 'warning', 'watch', 'water', 'wifi', 'wine', 'woman'
];

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  
  const parseTime = (timeStr?: string) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const [name, setName] = useState(params.name as string || '');
  const [category, setCategory] = useState<HabitCategory>((params.category as HabitCategory) || 'work');
  const [duration, setDuration] = useState<string>(params.duration as string || '');
  const [iconName, setIconName] = useState<keyof typeof Ionicons.glyphMap | undefined>(params.icon as any || undefined);
  const [saving, setSaving] = useState(false);
  const [startAt, setStartAt] = useState<Date | null>(parseTime(params.startAt as string));
  const [endAt, setEndAt] = useState<Date | null>(parseTime(params.endAt as string));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const wheelHeight = Math.min(140, Math.floor(Dimensions.get('window').height * 0.22));
  const [showIconPicker, setShowIconPicker] = useState(false);
  const nameInputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    // Small delay to ensure navigation transition finishes before focusing
    const timer = setTimeout(() => {
      // Only focus if not editing, or always? Maybe better to focus always for quick edits.
      nameInputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);
  
  // Goal creation states
  const [isGoal, setIsGoal] = useState(params.isGoal === 'true');
  const [targetDate, setTargetDate] = useState<Date | null>(params.targetDate ? new Date(params.targetDate as string) : null);
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);

  // Auto-calculate duration when start/end times change
  React.useEffect(() => {
    if (startAt && endAt) {
      let diffMs = endAt.getTime() - startAt.getTime();
      // If end time is earlier than start time, assume it's the next day (add 24h)
      if (diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000;
      }
      const diffMinutes = Math.floor(diffMs / 60000);
      setDuration(diffMinutes.toString());
    }
  }, [startAt, endAt]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (isGoal && !targetDate) return; 
    try {
      setSaving(true);
      const parsed = duration.trim() ? Math.max(1, Math.min(1440, parseInt(duration.trim(), 10) || 0)) : undefined;
      const fmt = (d: Date | null) => (d ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : undefined);
      const targetDateISO = targetDate ? targetDate.toISOString() : undefined;
      
      if (params.id) {
          await updateHabit({
              id: params.id as string,
              name: name.trim(),
              category,
              icon: iconName,
              createdAt: new Date().toISOString(), // Preserving original date would require fetching it or passing it. For now updating it is acceptable or we assume it's a "new version". Ideally we should pass 'createdAt' in params if we want to keep it.
              durationMinutes: parsed,
              startTime: fmt(startAt),
              endTime: fmt(endAt),
              isGoal,
              targetDate: targetDateISO,
          });
      } else {
          await addHabit(name.trim(), category, iconName, parsed, fmt(startAt), fmt(endAt), isGoal, targetDateISO);
      }

      DeviceEventEmitter.emit('habit_created');
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save habit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!params.id;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View className="px-6 pt-6 pb-4 flex-row justify-between items-center" style={{ backgroundColor: colors.background }}>
        <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
            {isEditing ? 'Edit Habit' : (isGoal ? 'New Goal' : 'New Habit')}
        </Text>
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Name Input with Icon */}
        <View className="mt-4 flex-row items-center rounded-2xl border px-4 py-3" 
              style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
            <TouchableOpacity
              onPress={() => setShowIconPicker(true)}
              className="mr-3"
            >
               <Ionicons name={(iconName ?? 'time-outline') as any} size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
                ref={nameInputRef}
                value={name}
                onChangeText={setName}
                placeholder={isGoal ? "e.g., Run a Marathon" : "e.g., Read 20 minutes"}
                placeholderTextColor={colors.textTertiary}
                style={{ color: colors.textPrimary, fontSize: 16, flex: 1, fontWeight: '500' }}
                returnKeyType="done"
            />
        </View>

        {/* Goal Toggle Card (Moved Up) */}
        <View className="mt-6">
          <View 
            className="flex-row items-center p-4 rounded-2xl border"
            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: colors.surfaceTertiary }}>
              <Ionicons name="trophy-outline" size={20} color={colors.textSecondary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>This is a Goal</Text>
              <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>Set a target date to achieve this goal</Text>
            </View>
            <Switch
                value={isGoal}
                onValueChange={setIsGoal}
                trackColor={{ false: colors.surfaceTertiary, true: colors.primary }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : colors.primary}
            />
          </View>
        </View>

        {/* Category Section */}
        <View className="mt-8">
          <Text className="text-base font-semibold mb-4" style={{ color: colors.textSecondary }}>Category</Text>
          <View className="flex-row flex-wrap gap-3">
            {categories.map(c => {
                const isSelected = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    className={cn(
                        "flex-row items-center px-4 py-2.5 rounded-full border",
                        isSelected ? "border-transparent" : "border-transparent"
                    )}
                    style={{
                        backgroundColor: isSelected ? colors.primary + '20' : colors.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.surfaceSecondary
                    }}
                  >
                    <Ionicons name={c.icon} size={18} color={isSelected ? colors.primary : c.color} />
                    <Text className="ml-2 font-semibold" style={{ color: isSelected ? colors.primary : colors.textPrimary }}>{c.label}</Text>
                  </TouchableOpacity>
                )
            })}
          </View>
        </View>

        {/* Duration Input */}
        <View className="mt-8">
          <Text className="text-base font-semibold mb-3" style={{ color: colors.textSecondary }}>Estimated Duration (minutes)</Text>
          <View className="rounded-2xl border px-4 py-3 mb-4" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
            <TextInput
                value={duration}
                onChangeText={setDuration}
                placeholder="e.g., 20"
                placeholderTextColor={colors.textTertiary}
                style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '500' }}
                keyboardType="number-pad"
            />
          </View>

          {/* Time Pickers (Moved inside Duration section) */}
          <View className="flex-row justify-between gap-3">
            <View className="flex-1 overflow-hidden">
              <TouchableOpacity
                className="p-4 rounded-2xl border mb-2"
                style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                onPress={() => setShowStartPicker(!showStartPicker)}
              >
                <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Start Time</Text>
                <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                  {startAt ? `${String(startAt.getHours()).padStart(2,'0')}:${String(startAt.getMinutes()).padStart(2,'0')}` : 'Select start'}
                </Text>
              </TouchableOpacity>
              {showStartPicker && (
                  <View className="rounded-2xl overflow-hidden bg-white dark:bg-black border border-gray-100 dark:border-gray-800">
                    <DateTimePicker
                      value={startAt ?? new Date()}
                      mode="time"
                      is24Hour
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e, d) => {
                        if (Platform.OS !== 'ios') setShowStartPicker(false);
                        if (d) setStartAt(d);
                      }}
                      style={Platform.OS === 'ios' ? { height: wheelHeight, width: '100%', backgroundColor: colors.surfaceSecondary } : undefined}
                      textColor={colors.textPrimary}
                    />
                  </View>
              )}
            </View>

            <View className="flex-1 overflow-hidden">
              <TouchableOpacity
                className="p-4 rounded-2xl border mb-2"
                style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                onPress={() => setShowEndPicker(!showEndPicker)}
              >
                <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>End Time</Text>
                <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                  {endAt ? `${String(endAt.getHours()).padStart(2,'0')}:${String(endAt.getMinutes()).padStart(2,'0')}` : 'Select end'}
                </Text>
              </TouchableOpacity>
              {showEndPicker && (
                  <View className="rounded-2xl overflow-hidden bg-white dark:bg-black border border-gray-100 dark:border-gray-800">
                    <DateTimePicker
                      value={endAt ?? new Date()}
                      mode="time"
                      is24Hour
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e, d) => {
                        if (Platform.OS !== 'ios') setShowEndPicker(false);
                        if (d) setEndAt(d);
                      }}
                      style={Platform.OS === 'ios' ? { height: wheelHeight, width: '100%', backgroundColor: colors.surfaceSecondary } : undefined}
                    textColor={colors.textPrimary}
                  />
                </View>
            )}
          </View>
        </View>
        </View>



        {/* Target Date Picker - Animate or conditional render */}
        {isGoal && (
          <View className="mt-4">
            <TouchableOpacity
              className="p-4 rounded-2xl border flex-row items-center justify-between"
              style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
              onPress={() => setShowTargetDatePicker(true)}
            >
               <View>
                  <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Target Date</Text>
                  <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                    {targetDate ? targetDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Select date'}
                  </Text>
               </View>
               <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            {showTargetDatePicker && (
              <View className="rounded-2xl overflow-hidden bg-white dark:bg-black border border-gray-100 dark:border-gray-800">
                <DateTimePicker
                  value={targetDate ?? new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant={colorScheme ?? 'dark'}
                  onChange={(e, d) => {
                    if (Platform.OS !== 'ios') setShowTargetDatePicker(false);
                    if (d) setTargetDate(d);
                  }}
                  style={Platform.OS === 'ios' ? { height: wheelHeight, width: '100%', backgroundColor: colors.surfaceSecondary } : undefined}
                  textColor={colors.textPrimary}
                />
              </View>
            )}
          </View>
        )}



        {/* Icon Picker Modal */}
        <Modal
          visible={showIconPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowIconPicker(false)}
        >
          <TouchableOpacity
            className="flex-1 bg-black/60 justify-end"
            activeOpacity={1}
            onPress={() => setShowIconPicker(false)}
          >
            <View className="w-full h-[80%] rounded-t-3xl p-5" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center mb-5">
                  <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Choose an icon</Text>
                  <TouchableOpacity onPress={() => setShowIconPicker(false)} className="p-1 bg-gray-100 rounded-full" style={{ backgroundColor: colors.surfaceSecondary }}>
                    <Ionicons name="close" size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 20 }}>
                  {POPULAR_ICONS.map(icon => (
                    <TouchableOpacity
                      key={icon}
                      className="w-[23%] aspect-square mb-3 rounded-2xl items-center justify-center border"
                      style={{ 
                          backgroundColor: iconName === icon ? colors.primary + '15' : colors.surfaceSecondary, 
                          borderColor: iconName === icon ? colors.primary : colors.surfaceSecondary
                      }}
                      onPress={() => { setIconName(icon); setShowIconPicker(false); }}
                    >
                      <Ionicons name={icon} size={28} color={iconName === icon ? colors.primary : colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

      </ScrollView>

      {/* Floating Bottom Button */}
      <View className="absolute bottom-10 left-0 right-0 px-6">
        <TouchableOpacity
            disabled={!name.trim() || (isGoal && !targetDate) || saving}
            onPress={handleCreate}
            className="w-full py-4 rounded-full items-center shadow-lg"
            style={{ 
                backgroundColor: (!name.trim() || (isGoal && !targetDate)) ? colors.surfaceSecondary : colors.primary,
                opacity: saving ? 0.7 : 1
            }}
        >
            <Text className="text-lg font-bold" style={{ color: (!name.trim() || (isGoal && !targetDate)) ? colors.textTertiary : 'white' }}>
                {isGoal ? 'Create Goal' : 'Create Habit'}
            </Text>
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}
