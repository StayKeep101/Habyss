import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { TimeRow } from '@/components/ui/TimeRow';
import { useTokens } from '@/hooks/useTokens';
import { useMeals } from '@/hooks/useMeals';
import { MEAL_LENGTHS, MEAL_NAMES, saveMeal, type MealId } from '@/lib/meals';
import { styles } from '@/styles/screens/meals.styles';

const ICONS: Record<MealId, 'cafe' | 'restaurant' | 'fast-food'> = { breakfast: 'cafe', lunch: 'restaurant', supper: 'fast-food' };

/**
 * When you eat, and for how long. Each meal that is on is a fixed block in
 * the Roadmap timeline: it never moves, and nothing is moved into it.
 */
export default function MealsScreen() {
    const t = useTokens();
    const meals = useMeals();
    return (
        <SheetScreen title="Meals" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[t.type.bodySmall, { color: t.color.textMuted }]}>
                    Meals sit in your timeline at their time and are never moved. Anything running late is pushed past them, not into them.
                </Text>
                {(Object.keys(MEAL_NAMES) as MealId[]).map(id => {
                    const meal = meals[id];
                    return (
                        <View key={id}>
                            <SettingsGroup title={MEAL_NAMES[id]}>
                                <SettingsRow icon={ICONS[id]} color={t.color.warning} label="In my timeline"
                                    toggle={meal.on} onToggle={on => void saveMeal(id, { on })} />
                                {meal.on ? (
                                    <SettingsRow icon="hourglass" color={t.color.accent} label="Takes"
                                        choices={MEAL_LENGTHS.map(minutes => ({ id: String(minutes), label: `${minutes}m` }))}
                                        chosen={String(meal.minutes)} onChoose={value => void saveMeal(id, { minutes: Number(value) })} />
                                ) : null}
                            </SettingsGroup>
                            {meal.on ? (
                                <TimeRow icon="time" label="At" value={meal.time} accent={t.color.accent} onChange={time => void saveMeal(id, { time })} />
                            ) : null}
                        </View>
                    );
                })}
            </ScrollView>
        </SheetScreen>
    );
}
