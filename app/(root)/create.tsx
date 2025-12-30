import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, DeviceEventEmitter, Platform, Dimensions, ScrollView, Modal, Switch, KeyboardAvoidingView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addHabit, updateHabit, HabitCategory, HabitType, GoalPeriod, ChartType } from '@/lib/habits';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { cn } from '@/lib/utils';
import { useRouter, useLocalSearchParams } from 'expo-router';

// --- Constants ---

const categories: { key: HabitCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'health', label: 'Health', icon: 'medical' },
  { key: 'fitness', label: 'Fitness', icon: 'fitness' },
  { key: 'work', label: 'Work', icon: 'briefcase' },
  { key: 'personal', label: 'Personal', icon: 'person' },
  { key: 'mindfulness', label: 'Mindfulness', icon: 'leaf' },
  { key: 'misc', label: 'Misc', icon: 'grid' },
];

const PRESET_COLORS = [
    '#6B46C1', // Purple (Build default)
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F97316', // Orange
    '#EF4444', // Red (Quit default)
    '#EC4899', // Pink
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#374151', // Dark Gray
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

  // --- State ---
  const [name, setName] = useState(params.name as string || '');
  const [description, setDescription] = useState(params.description as string || '');
  const [type, setType] = useState<HabitType>((params.type as HabitType) || 'build');
  const [iconName, setIconName] = useState<keyof typeof Ionicons.glyphMap | undefined>(params.icon as any || undefined);
  const [color, setColor] = useState(params.color as string || PRESET_COLORS[0]);
  const [category, setCategory] = useState<HabitCategory>((params.category as HabitCategory) || 'work');
  
  const [goalValue, setGoalValue] = useState(params.goalValue ? String(params.goalValue) : '1');
  const [unit, setUnit] = useState(params.unit as string || 'count');
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>((params.goalPeriod as GoalPeriod) || 'daily');
  
  const [startAt, setStartAt] = useState<Date | null>(parseTime(params.startTime as string));
  const [endAt, setEndAt] = useState<Date | null>(parseTime(params.endTime as string));
  const [startDate, setStartDate] = useState<Date>(params.startDate ? new Date(params.startDate as string) : new Date());
  const [endDate, setEndDate] = useState<Date | null>(params.endDate ? new Date(params.endDate as string) : null);
  
  const [taskDays, setTaskDays] = useState<string[]>(params.taskDays ? JSON.parse(params.taskDays as string) : ['mon','tue','wed','thu','fri','sat','sun']);
  const [chartType, setChartType] = useState<ChartType>((params.chartType as ChartType) || 'bar');
  
  const [isArchived, setIsArchived] = useState(params.isArchived === 'true');
  const [remindersEnabled, setRemindersEnabled] = useState(false); // Simplified for now
  
  const [saving, setSaving] = useState(false);
  
  // Pickers visibility
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  const wheelHeight = Math.min(140, Math.floor(Dimensions.get('window').height * 0.22));
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (type === 'quit' && color === PRESET_COLORS[0]) setColor('#EF4444');
    if (type === 'build' && color === '#EF4444') setColor(PRESET_COLORS[0]);
  }, [type]);

  useEffect(() => {
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setSaving(true);
      const fmtTime = (d: Date | null) => (d ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : undefined);
      const fmtDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : undefined;

      const habitData = {
          name: name.trim(),
          description: description.trim(),
          type,
          icon: iconName,
          color,
          category,
          goalValue: parseInt(goalValue) || 1,
          unit,
          goalPeriod,
          startTime: fmtTime(startAt),
          endTime: fmtTime(endAt),
          startDate: startDate.toISOString(),
          endDate: endDate ? endDate.toISOString() : undefined,
          isArchived,
          taskDays,
          reminders: [],
          chartType,
          showMemo: false
      };

      if (params.id) {
          await updateHabit({
              id: params.id as string,
              ...habitData
          });
      } else {
          await addHabit(habitData);
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
            {isEditing ? 'Edit Habit' : 'Custom Habit'}
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
        
        {/* Section: Habit Details */}
        <View className="mb-8">
            <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Habit Details</Text>
            
            {/* Name & Icon */}
            <View className="flex-row gap-3 mb-3">
                 <TouchableOpacity
                    onPress={() => setShowIconPicker(true)}
                    className="w-16 h-16 rounded-2xl items-center justify-center border"
                    style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                >
                    <Ionicons name={(iconName ?? 'add') as any} size={32} color={color} />
                </TouchableOpacity>
                <View className="flex-1 rounded-2xl border px-4 justify-center" 
                      style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                    <TextInput
                        ref={nameInputRef}
                        value={name}
                        onChangeText={setName}
                        placeholder="Habit Name"
                        placeholderTextColor={colors.textTertiary}
                        style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}
                        returnKeyType="next"
                    />
                </View>
            </View>

            {/* Description */}
            <View className="rounded-2xl border px-4 py-3 mb-4" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Description (optional)"
                    placeholderTextColor={colors.textTertiary}
                    style={{ color: colors.textPrimary, fontSize: 15, minHeight: 60 }}
                    multiline
                    textAlignVertical="top"
                />
            </View>

            {/* Type Selection */}
            <View className="flex-row rounded-xl p-1 mb-4 border" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                <TouchableOpacity 
                    onPress={() => setType('build')}
                    className={cn("flex-1 py-2 rounded-lg items-center", type === 'build' ? "bg-white dark:bg-gray-700 shadow-sm" : "")}
                >
                    <Text className={cn("font-semibold", type === 'build' ? "text-purple-600" : "text-gray-400")}>Build</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setType('quit')}
                    className={cn("flex-1 py-2 rounded-lg items-center", type === 'quit' ? "bg-white dark:bg-gray-700 shadow-sm" : "")}
                >
                    <Text className={cn("font-semibold", type === 'quit' ? "text-red-500" : "text-gray-400")}>Quit</Text>
                </TouchableOpacity>
            </View>

            {/* Color Picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-3">
                    {PRESET_COLORS.map(c => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => setColor(c)}
                            className="w-10 h-10 rounded-full items-center justify-center border-2"
                            style={{ backgroundColor: c, borderColor: color === c ? colors.textPrimary : 'transparent' }}
                        >
                            {color === c && <Ionicons name="checkmark" size={20} color="white" />}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
            
            {/* Category */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                    {categories.map(c => {
                         const isSelected = category === c.key;
                         return (
                            <TouchableOpacity
                                key={c.key}
                                onPress={() => setCategory(c.key)}
                                className="flex-row items-center px-3 py-2 rounded-full border"
                                style={{
                                    backgroundColor: isSelected ? color + '20' : colors.surfaceSecondary,
                                    borderColor: isSelected ? color : colors.surfaceSecondary
                                }}
                            >
                                <Ionicons name={c.icon} size={16} color={isSelected ? color : colors.textSecondary} />
                                <Text className="ml-2 text-sm font-medium" style={{ color: isSelected ? color : colors.textPrimary }}>{c.label}</Text>
                            </TouchableOpacity>
                         )
                    })}
                </View>
            </ScrollView>
        </View>

        {/* Section: Goal Setup */}
        <View className="mb-8">
            <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Goal Setup</Text>
            
            <View className="flex-row gap-3">
                {/* Value & Unit */}
                <View className="flex-1 rounded-2xl border p-3" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                    <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Target</Text>
                    <View className="flex-row items-center">
                        <TextInput
                            value={goalValue}
                            onChangeText={setGoalValue}
                            keyboardType="numeric"
                            className="text-xl font-bold mr-2 flex-1"
                            style={{ color: colors.textPrimary }}
                        />
                        <TextInput
                             value={unit}
                             onChangeText={setUnit}
                             placeholder="unit"
                             placeholderTextColor={colors.textTertiary}
                             className="text-base font-medium text-right w-16"
                             style={{ color: colors.textSecondary }}
                        />
                    </View>
                </View>

                {/* Period */}
                <View className="flex-1 rounded-2xl border p-3" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                     <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Frequency</Text>
                     <View className="flex-row flex-wrap gap-1 mt-1">
                        {['daily', 'weekly', 'monthly'].map((p) => (
                             <TouchableOpacity 
                                key={p} 
                                onPress={() => setGoalPeriod(p as GoalPeriod)}
                                className={cn("px-2 py-1 rounded-md", goalPeriod === p ? "bg-white/10" : "")}
                            >
                                <Text className={cn("text-xs capitalize", goalPeriod === p ? "font-bold" : "text-gray-500")} style={{ color: goalPeriod === p ? color : colors.textSecondary }}>{p}</Text>
                             </TouchableOpacity>
                        ))}
                     </View>
                </View>
            </View>
        </View>

        {/* Section: Schedule */}
        <View className="mb-8">
            <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Schedule</Text>
            
            {/* Task Days */}
            <View className="flex-row justify-between mb-4">
                {['mon','tue','wed','thu','fri','sat','sun'].map((day, i) => {
                    const isSelected = taskDays.includes(day);
                    const label = day.charAt(0).toUpperCase();
                    return (
                        <TouchableOpacity
                            key={day}
                            onPress={() => {
                                if (isSelected && taskDays.length > 1) {
                                    setTaskDays(taskDays.filter(d => d !== day));
                                } else if (!isSelected) {
                                    setTaskDays([...taskDays, day]);
                                }
                            }}
                            className="w-10 h-10 rounded-full items-center justify-center border"
                            style={{ 
                                backgroundColor: isSelected ? color : colors.surfaceSecondary,
                                borderColor: isSelected ? color : colors.border
                            }}
                        >
                            <Text className={cn("font-bold", isSelected ? "text-white" : "")} style={{ color: isSelected ? 'white' : colors.textSecondary }}>{label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Time Range */}
            <View className="flex-row gap-3">
                 <TouchableOpacity
                    className="flex-1 p-3 rounded-2xl border"
                    style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                    onPress={() => setShowStartPicker(true)}
                >
                    <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Start Time</Text>
                    <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                        {startAt ? `${String(startAt.getHours()).padStart(2,'0')}:${String(startAt.getMinutes()).padStart(2,'0')}` : 'Anytime'}
                    </Text>
                </TouchableOpacity>

                 <TouchableOpacity
                    className="flex-1 p-3 rounded-2xl border"
                    style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                    onPress={() => setShowEndPicker(true)}
                >
                    <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>End Time</Text>
                    <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                        {endAt ? `${String(endAt.getHours()).padStart(2,'0')}:${String(endAt.getMinutes()).padStart(2,'0')}` : 'Anytime'}
                    </Text>
                </TouchableOpacity>
            </View>
            
            {/* Date Pickers Modals */}
            {(showStartPicker || showEndPicker) && (Platform.OS !== 'ios') && (
                 // Android pickers would be triggered directly, but for now logic is simplified
                 <View />
            )}
             {/* iOS Inline Pickers Logic */}
            {showStartPicker && Platform.OS === 'ios' && (
                <View className="mt-2 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900">
                     <DateTimePicker
                        value={startAt ?? new Date()}
                        mode="time"
                        display="spinner"
                        onChange={(e, d) => { if (d) setStartAt(d); }}
                        style={{ height: wheelHeight }}
                        textColor={colors.textPrimary}
                    />
                     <TouchableOpacity onPress={() => setShowStartPicker(false)} className="py-2 items-center border-t border-gray-200 dark:border-gray-800"><Text style={{color: color}}>Done</Text></TouchableOpacity>
                </View>
            )}
            {showEndPicker && Platform.OS === 'ios' && (
                 <View className="mt-2 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900">
                     <DateTimePicker
                        value={endAt ?? new Date()}
                        mode="time"
                        display="spinner"
                        onChange={(e, d) => { if (d) setEndAt(d); }}
                        style={{ height: wheelHeight }}
                        textColor={colors.textPrimary}
                    />
                     <TouchableOpacity onPress={() => setShowEndPicker(false)} className="py-2 items-center border-t border-gray-200 dark:border-gray-800"><Text style={{color: color}}>Done</Text></TouchableOpacity>
                </View>
            )}
        </View>

        {/* Section: Analytics */}
        <View className="mb-8">
            <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Analytics</Text>
            <View className="flex-row rounded-xl p-1 border" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                <TouchableOpacity 
                    onPress={() => setChartType('bar')}
                    className={cn("flex-1 py-2 rounded-lg items-center flex-row justify-center gap-2", chartType === 'bar' ? "bg-white dark:bg-gray-700 shadow-sm" : "")}
                >
                    <Ionicons name="bar-chart" size={16} color={chartType === 'bar' ? color : colors.textSecondary} />
                    <Text className="font-semibold" style={{ color: chartType === 'bar' ? color : colors.textSecondary }}>Bar Chart</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setChartType('line')}
                    className={cn("flex-1 py-2 rounded-lg items-center flex-row justify-center gap-2", chartType === 'line' ? "bg-white dark:bg-gray-700 shadow-sm" : "")}
                >
                    <Ionicons name="pulse" size={16} color={chartType === 'line' ? color : colors.textSecondary} />
                    <Text className="font-semibold" style={{ color: chartType === 'line' ? color : colors.textSecondary }}>Line Chart</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Section: Term */}
        <View className="mb-8">
             <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Term</Text>
             
             <View className="rounded-2xl border overflow-hidden" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                <TouchableOpacity 
                    className="flex-row justify-between items-center p-4 border-b"
                    style={{ borderColor: colors.border }}
                    onPress={() => setShowStartDatePicker(true)}
                >
                    <Text style={{ color: colors.textPrimary }}>Start Date</Text>
                    <Text style={{ color: colors.textSecondary }}>{startDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
                
                 <TouchableOpacity 
                    className="flex-row justify-between items-center p-4"
                    onPress={() => setShowEndDatePicker(true)}
                >
                    <Text style={{ color: colors.textPrimary }}>End Date</Text>
                    <Text style={{ color: colors.textSecondary }}>{endDate ? endDate.toLocaleDateString() : 'Forever'}</Text>
                </TouchableOpacity>
             </View>
             
             {/* Date Pickers */}
             {showStartDatePicker && (
                 <View className="mt-2 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900">
                    <DateTimePicker
                        value={startDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e, d) => {
                             if (Platform.OS !== 'ios') setShowStartDatePicker(false);
                             if (d) setStartDate(d);
                        }}
                        style={Platform.OS === 'ios' ? { height: wheelHeight } : undefined}
                         textColor={colors.textPrimary}
                    />
                    {Platform.OS === 'ios' && <TouchableOpacity onPress={() => setShowStartDatePicker(false)} className="py-2 items-center border-t border-gray-200 dark:border-gray-800"><Text style={{color: color}}>Done</Text></TouchableOpacity>}
                 </View>
             )}
             {showEndDatePicker && (
                 <View className="mt-2 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900">
                    <View className="flex-row justify-between p-2 bg-gray-200 dark:bg-gray-800">
                        <TouchableOpacity onPress={() => { setEndDate(null); setShowEndDatePicker(false); }}><Text style={{color: colors.textSecondary}}>Clear</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowEndDatePicker(false)}><Text style={{color: color}}>Done</Text></TouchableOpacity>
                    </View>
                    <DateTimePicker
                        value={endDate ?? new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e, d) => {
                             if (Platform.OS !== 'ios') setShowEndDatePicker(false);
                             if (d) setEndDate(d);
                        }}
                        style={Platform.OS === 'ios' ? { height: wheelHeight } : undefined}
                         textColor={colors.textPrimary}
                    />
                 </View>
             )}
        </View>


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
                          backgroundColor: iconName === icon ? color + '15' : colors.surfaceSecondary, 
                          borderColor: iconName === icon ? color : colors.surfaceSecondary
                      }}
                      onPress={() => { setIconName(icon); setShowIconPicker(false); }}
                    >
                      <Ionicons name={icon} size={28} color={iconName === icon ? color : colors.textSecondary} />
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
            disabled={!name.trim() || saving}
            onPress={handleCreate}
            className="w-full py-4 rounded-full items-center shadow-lg"
            style={{ 
                backgroundColor: !name.trim() ? colors.surfaceSecondary : color,
                opacity: saving ? 0.7 : 1,
                shadowColor: color,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8
            }}
        >
            <Text className="text-lg font-bold" style={{ color: !name.trim() ? colors.textTertiary : 'white' }}>
                {isEditing ? 'Save Changes' : 'Create Habit'}
            </Text>
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}
