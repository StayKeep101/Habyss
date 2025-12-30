import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { cn } from '@/lib/utils';

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

const ICON_KEYWORDS: Record<string, string[]> = {
  'fitness': ['run', 'gym', 'workout', 'exercise', 'health', 'muscle', 'lift', 'sport', 'fit'],
  'barbell': ['gym', 'lift', 'strength', 'weight', 'workout'],
  'football': ['sport', 'play', 'game'],
  'basketball': ['sport', 'play', 'game', 'hoop'],
  'tennisball': ['sport', 'play', 'game', 'court'],
  'walk': ['step', 'hike', 'move', 'exercise', 'stroll'],
  'bicycle': ['cycle', 'ride', 'bike', 'exercise', 'commute'],
  'book': ['read', 'study', 'learn', 'knowledge', 'school', 'exam', 'page'],
  'library': ['read', 'study', 'book', 'quiet'],
  'water': ['drink', 'hydrate', 'thirst', 'health', 'bottle', 'aqua'],
  'moon': ['sleep', 'bed', 'night', 'rest', 'dream', 'dark'],
  'sunny': ['morning', 'wake', 'day', 'early', 'light', 'sun'],
  'alarm': ['wake', 'morning', 'time', 'clock', 'alert'],
  'code': ['program', 'dev', 'software', 'computer', 'tech', 'hack', 'build'],
  'laptop': ['work', 'computer', 'tech', 'job'],
  'brush': ['art', 'draw', 'paint', 'create', 'sketch', 'design'],
  'musical-notes': ['music', 'play', 'listen', 'instrument', 'song', 'sing'],
  'headset': ['listen', 'music', 'call', 'gaming'],
  'game-controller': ['game', 'play', 'console', 'video', 'fun'],
  'restaurant': ['eat', 'food', 'dinner', 'lunch', 'meal', 'dine'],
  'cafe': ['coffee', 'tea', 'drink', 'morning', 'break'],
  'fast-food': ['eat', 'food', 'burger', 'junk'],
  'nutrition': ['food', 'health', 'diet', 'eat', 'fruit'],
  'medkit': ['medicine', 'pill', 'health', 'doctor', 'sick', 'cure'],
  'medical': ['health', 'doctor', 'hospital'],
  'leaf': ['meditate', 'mindfulness', 'calm', 'nature', 'yoga', 'breathe', 'zen'],
  'cart': ['shop', 'buy', 'grocery', 'store', 'market'],
  'trash': ['clean', 'tidy', 'chore', 'garbage'],
  'home': ['house', 'clean', 'chore', 'family', 'stay'],
  'paw': ['dog', 'cat', 'pet', 'walk', 'animal'],
  'cash': ['save', 'budget', 'finance', 'cost', 'money', 'pay'],
  'card': ['pay', 'buy', 'spend'],
  'people': ['social', 'meet', 'friends', 'family', 'group'],
  'chatbubble': ['talk', 'message', 'social', 'speak'],
  'call': ['phone', 'contact', 'talk'],
  'mail': ['email', 'message', 'send', 'letter'],
  'journal': ['write', 'diary', 'note', 'reflect', 'log'],
  'create': ['write', 'edit', 'make'],
  'beer': ['drink', 'alcohol', 'party'],
  'wine': ['drink', 'alcohol', 'party', 'relax'],
  'desktop': ['work', 'computer', 'screen', 'monitor'],
  'briefcase': ['work', 'job', 'business', 'office'],
  'school': ['learn', 'study', 'class', 'student'],
  'bus': ['commute', 'travel', 'transport'],
  'car': ['drive', 'travel', 'commute'],
  'train': ['commute', 'travel', 'transport'],
  'globe': ['travel', 'world', 'explore'],
  'camera': ['photo', 'picture', 'capture', 'memory'],
  'videocam': ['video', 'record', 'film', 'movie'],
  'film': ['movie', 'watch', 'cinema'],
  'tv': ['watch', 'show', 'series', 'movie'],
  'bed': ['sleep', 'rest', 'nap'],
  'happy': ['mood', 'feel', 'good'],
  'sad': ['mood', 'feel', 'bad'],
  'heart': ['love', 'like', 'health', 'cardio'],
  'pulse': ['health', 'heart', 'rate', 'cardio'],
  'calendar': ['plan', 'schedule', 'date', 'event'],
  'time': ['schedule', 'clock', 'duration'],
  'hourglass': ['wait', 'time', 'duration'],
  'timer': ['time', 'count', 'stopwatch'],
};

interface IconPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (icon: keyof typeof Ionicons.glyphMap) => void;
  selectedIcon?: string;
  habitName: string;
  color: string;
}

export function IconPicker({ visible, onClose, onSelect, selectedIcon, habitName, color }: IconPickerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reset search when modal opens
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
    }
  }, [visible]);

  // Auto-suggestions based on habit name
  const suggestions = useMemo(() => {
    if (!habitName.trim()) return [];
    
    const terms = habitName.toLowerCase().split(' ').filter(t => t.length > 2);
    if (terms.length === 0) return [];

    const scoredIcons = POPULAR_ICONS.map(icon => {
      let score = 0;
      const keywords = ICON_KEYWORDS[icon] || [];
      
      // Check exact match with icon name
      if (terms.some(t => icon.includes(t))) score += 10;
      
      // Check keywords
      terms.forEach(term => {
        if (keywords.some(k => k.includes(term))) score += 5;
      });

      return { icon, score };
    });

    return scoredIcons
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Top 3
      .map(item => item.icon);
  }, [habitName]);

  // Filtered icons based on search
  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_ICONS;
    
    const query = searchQuery.toLowerCase();
    return POPULAR_ICONS.filter(icon => {
      // Match name
      if (icon.includes(query)) return true;
      // Match keywords
      const keywords = ICON_KEYWORDS[icon];
      if (keywords && keywords.some(k => k.includes(query))) return true;
      return false;
    });
  }, [searchQuery]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        className="flex-1 bg-black/60 justify-end"
        activeOpacity={1}
        onPress={onClose}
      >
        <View 
            className="w-full h-[85%] rounded-t-3xl bg-white dark:bg-gray-900" 
            style={{ backgroundColor: colors.surface }}
        >
            {/* Header */}
            <View className="flex-row justify-between items-center p-5 border-b" style={{ borderColor: colors.border }}>
              <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>Choose an icon</Text>
              <TouchableOpacity onPress={onClose} className="p-2 rounded-full" style={{ backgroundColor: colors.surfaceSecondary }}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View className="px-5 py-3">
                <View className="flex-row items-center px-4 py-3 rounded-2xl border" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                    <Ionicons name="search" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
                    <TextInput
                        placeholder="Search icons (e.g. gym, read...)"
                        placeholderTextColor={colors.textTertiary}
                        style={{ flex: 1, color: colors.textPrimary, fontSize: 16 }}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Suggestions */}
                {suggestions.length > 0 && !searchQuery && (
                    <View className="mb-6">
                        <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>
                            Suggested for "{habitName}"
                        </Text>
                        <View className="flex-row gap-3">
                            {suggestions.map(icon => (
                                <TouchableOpacity
                                    key={`suggest-${icon}`}
                                    className="w-16 h-16 rounded-2xl items-center justify-center border-2"
                                    style={{ 
                                        backgroundColor: selectedIcon === icon ? color + '20' : colors.surfaceSecondary,
                                        borderColor: selectedIcon === icon ? color : 'transparent'
                                    }}
                                    onPress={() => { onSelect(icon); onClose(); }}
                                >
                                    <Ionicons name={icon} size={32} color={selectedIcon === icon ? color : colors.textPrimary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* All Icons Grid */}
                <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>
                    {searchQuery ? 'Search Results' : 'All Icons'}
                </Text>
                
                {filteredIcons.length === 0 ? (
                    <View className="items-center justify-center py-10">
                        <Ionicons name="search" size={48} color={colors.textTertiary} style={{ opacity: 0.5 }} />
                        <Text className="text-base font-medium mt-4" style={{ color: colors.textSecondary }}>No icons found</Text>
                        <Text className="text-sm mt-1" style={{ color: colors.textTertiary }}>Try searching for something else</Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap justify-between">
                        {filteredIcons.map(icon => (
                            <TouchableOpacity
                                key={icon}
                                className="w-[23%] aspect-square mb-3 rounded-2xl items-center justify-center border"
                                style={{ 
                                    backgroundColor: selectedIcon === icon ? color + '15' : colors.surfaceSecondary, 
                                    borderColor: selectedIcon === icon ? color : colors.surfaceSecondary
                                }}
                                onPress={() => { onSelect(icon); onClose(); }}
                            >
                                <Ionicons name={icon} size={28} color={selectedIcon === icon ? color : colors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
