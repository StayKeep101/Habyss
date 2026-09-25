import { APP_NAME, APP_SLOGAN } from '@/constants/brand';
import { FontFamily, UIStyles, Radius } from '@/constants/DesignSystem';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/constants/themeContext';

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: { ...UIStyles.screenContent,

        alignItems: 'center',
     },
    logoSection: {
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 16,
    },
    logoMark: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 16,
    },
    logoImage: { width: 134, height: 134 },
    appName: {
        fontSize: 28,
        fontFamily: FontFamily.bold,
    },
    version: {
        fontSize: 13,
        fontFamily: FontFamily.regular,
        marginTop: 4,
    },
    tagline: {
        fontSize: 15,
        textAlign: 'center',
        fontFamily: FontFamily.regular,
        marginBottom: 32,
    },
    card: {
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
        width: '100%',
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    linkText: {
        flex: 1,
        fontSize: 15,
        fontFamily: FontFamily.regular,
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    footer: {
        fontSize: 12,
        fontFamily: FontFamily.regular,
        marginTop: 32,
    },
});

export default About;
