import React from 'react';
import { ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { ListItem } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { LEGAL, LEGAL_UPDATED, type LegalDoc } from '@/constants/legal';
import { styles } from '@/styles/screens/legal.styles';

/**
 * The privacy policy or the terms (`?doc=privacy|terms`), one card per point.
 * In the app rather than only on the web, so they open offline too.
 */
export default function Legal() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { doc } = useLocalSearchParams<{ doc?: string }>();
    const page = LEGAL[(doc === 'terms' ? 'terms' : 'privacy') as LegalDoc];
    return (
        <SheetScreen title={page.title} onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.intro, { color: colors.textSecondary }]}>{page.intro}</Text>
                {page.sections.map((section, index) => (
                    <ListItem key={section.title} index={index}>
                        <VoidCard style={styles.card}>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>{section.title}</Text>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>{section.body}</Text>
                        </VoidCard>
                    </ListItem>
                ))}
                <Text style={[styles.updated, { color: colors.textTertiary }]}>Updated {LEGAL_UPDATED}</Text>
            </ScrollView>
        </SheetScreen>
    );
}
