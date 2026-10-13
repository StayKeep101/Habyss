import { APP_NAME, APP_SLOGAN } from '@/constants/brand';
import { FontFamily, UIStyles, Radius } from '@/theme/designSystem';
import { ScrollView, View, Text, TouchableOpacity, Linking, Image } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { useTheme } from '@/context/ThemeContext';
import { styles } from '@/styles/screens/about.styles';

const About = () => {
    // const colorScheme = useColorScheme();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { lightFeedback } = useHaptics();

    const version = Constants.expoConfig?.version || '1.0.0';

    return (
        <SheetScreen title="About Habyss" onBack={() => router.back()}>

                {/* Content */}
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Logo & Name */}
                    <View style={styles.logoSection}>
                        {/* The app's own mark, not a stand-in glyph. */}
                        <View style={styles.logoMark}>
                            <Image
                                source={require('@/assets/images/Habyss Logo.png')}
                                style={styles.logoImage}
                                resizeMode="cover"
                                accessibilityIgnoresInvertColors
                            />
                        </View>
                        <Text style={[styles.appName, { color: colors.textPrimary }]}>{APP_NAME}</Text>
                        <Text style={[styles.version, { color: colors.textSecondary }]}>Version {version}</Text>
                    </View>

                    {/* Tagline */}
                    <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                        {APP_SLOGAN}
                    </Text>

                    {/* Links */}
                    <VoidCard
                        glass={!isTrueDark}
                        intensity={isLight ? 20 : 80}
                        style={[
                            styles.card,
                            {
                                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                                borderColor: colors.border
                            }
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.linkRow}
                            onPress={() => { lightFeedback(); Linking.openURL('https://habyss.app/privacy'); }}
                        >
                            <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.linkText, { color: colors.textPrimary }]}>Privacy Policy</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <TouchableOpacity
                            style={styles.linkRow}
                            onPress={() => { lightFeedback(); Linking.openURL('https://habyss.app/terms'); }}
                        >
                            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.linkText, { color: colors.textPrimary }]}>Terms of Service</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </VoidCard>

                    {/* Footer */}
                    <Text style={[styles.footer, { color: colors.textTertiary }]}>
                        Made with ♥ for habit builders
                    </Text>
                </ScrollView>
            </SheetScreen>
    );
};


export default About;
