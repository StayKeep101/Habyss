import { SheetScreen } from '@/components/Layout/SheetScreen';
import { useState, useEffect, useCallback } from 'react';
import {View} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { RoadmapView } from '@/components/Home/RoadmapView';
import { getHabits as loadHabits, getCompletions, Habit as StoreHabit } from '@/lib/habitsSQLite';
import { useRouter } from 'expo-router';
import { on } from '@/lib/appEvents';

interface Habit extends StoreHabit {
  streak?: number;
  completed?: boolean;
}

export default function RoadmapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedHabits, setCompletedHabits] = useState(0);
  const [totalHabits, setTotalHabits] = useState(0);

  const loadData = useCallback(async () => {
    const h = await loadHabits();
    const c = await getCompletions();
    const mapped: Habit[] = h.map(item => ({ ...item, completed: !!c[item.id], streak: 0 }));
    setHabits(mapped);
    setTotalHabits(mapped.length);
    setCompletedHabits(Object.values(c).filter(Boolean).length);
  }, []);

  useEffect(() => {
    loadData();
    const sub = on('habit_created', loadData);
    return () => sub.remove();
  }, [loadData]);

  // Handler for day press - maybe show a simple alert or modal in future
  const handleDayPress = (day: any) => {
    // For now, just logging or simple feedback
    console.log('Day pressed:', day);
  };

  return (
    <SheetScreen title="My journey" onBack={() => router.back()}>
      <View style={{ flex: 1 }}>
         <RoadmapView 
            onDayPress={handleDayPress} 
            habits={habits}
            completedHabitsCount={completedHabits}
            totalHabitsCount={totalHabits}
         />
      </View>
    </SheetScreen>
  );
}
