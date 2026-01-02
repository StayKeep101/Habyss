import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Animated, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptics } from '@/hooks/useHaptics';

interface CommandCenterProps {
    visible: boolean;
    onClose: () => void;
    user: any;
}

const { height } = Dimensions.get('window');

export const CommandCenter: React.FC<CommandCenterProps> = ({ visible, onClose, user }) => {
    const { theme, setTheme } = useTheme();
    const colors = Colors[theme];
    const router = useRouter();
    const { lightFeedback, mediumFeedback } = useHaptics();

    // Animation for slide up
    const slideAnim = React.useRef(new Animated.Value(height)).current;
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    stiffness: 90
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: height,
                    duration: 250,
                    useNativeDriver: true
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true
                })
            ]).start();
        }
    }, [visible]);

    const handleNavigation = (route: string) => {
        lightFeedback();
        onClose();
        // Small delay to allow close animation to start feeling responsive
        setTimeout(() => {
            router.push(route as any);
        }, 100);
    };

    const handleThemeToggle = () => {
        mediumFeedback();
        if (theme === 'light') setTheme('abyss');
        else if (theme === 'abyss') setTheme('trueDark');
        else setTheme('light');
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.container}>
                <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
                    <TouchableOpacity style={styles.backdropTouch} onPress={onClose} />
                </Animated.View>

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.background === '#000000' ? '#121212' : colors.background,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <View style={styles.dragHandle} />

                    <ScrollView contentContainerStyle={styles.content}>
                        {/* Header Identity */}
                        <View style={styles.header}>
                            <View style={[styles.avatarBig, { borderColor: colors.primary }]}>
                                <Text style={styles.avatarTextBig}>
                                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                                </Text>
                            </View>
                            <Text style={[styles.email, { color: colors.textPrimary }]}>{user?.email}</Text>
                            <Text style={[styles.status, { color: colors.textSecondary }]}>Level 5 • Grandmaster</Text>
                        </View>

                        {/* Quick Toggles */}
                        <View style={styles.togglesRow}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, { backgroundColor: colors.surfaceSecondary }]}
                                onPress={handleThemeToggle}
                            >
                                <Ionicons
                                    name={theme === 'light' ? 'sunny' : 'moon'}
                                    size={24}
                                    color={theme === 'light' ? '#F59E0B' : '#818CF8'}
                                />
                                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
                                    {theme === 'light' ? 'Light' : theme === 'abyss' ? 'Abyss' : 'Dark'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.toggleBtn, { backgroundColor: colors.surfaceSecondary }]}
                                onPress={() => handleNavigation('/settings')}
                            >
                                <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
                                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Settings</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Vision Portal */}
                        <TouchableOpacity
                            style={styles.visionPortal}
                            onPress={() => handleNavigation('/vision-board')}
                        >
                            <LinearGradient
                                colors={['#4F46E5', '#9333EA']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.visionGradient}
                            >
                                <View style={styles.visionContent}>
                                    <Ionicons name="sparkles" size={32} color="white" />
                                    <View>
                                        <Text style={styles.visionTitle}>Vision Board</Text>
                                        <Text style={styles.visionSubtitle}>Manifest your dreams</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={24} color="white" style={{ marginLeft: 'auto' }} />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Menu Items */}
                        <View style={styles.menuGroup}>
                            <MenuItem icon="bar-chart" label="Analytics" color="#10B981" onClick={() => handleNavigation('/(tabs)/statistics')} themeColors={colors} />
                            <MenuItem icon="ribbon" label="Achievements" color="#F59E0B" onClick={() => { }} themeColors={colors} />
                            <MenuItem icon="people" label="Community" color="#EC4899" onClick={() => { }} themeColors={colors} />
                        </View>

                        <View style={styles.menuGroup}>
                            <MenuItem icon="notifications" label="Notifications" color={colors.textSecondary} onClick={() => handleNavigation('/notifications')} themeColors={colors} />
                            <MenuItem icon="lock-closed" label="Privacy" color={colors.textSecondary} onClick={() => handleNavigation('/privacy')} themeColors={colors} />
                            <MenuItem icon="help-circle" label="Support" color={colors.textSecondary} onClick={() => { }} themeColors={colors} />
                        </View>

                        <TouchableOpacity style={styles.logoutBtn} onPress={() => {
                            onClose();
                            // Implementation of logout triggers externally or passed down
                        }}>
                            <Text style={styles.logoutText}>Log Out</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const MenuItem = ({ icon, label, color, onClick, themeColors }: any) => (
    <TouchableOpacity style={[styles.menuItem, { backgroundColor: themeColors.surfaceSecondary }]} onPress={onClick}>
        <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.menuLabel, { color: themeColors.textPrimary }]}>{label}</Text>
        <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdropTouch: {
        flex: 1,
    },
    sheet: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '85%',
        paddingTop: 16,
        paddingHorizontal: 24,
        paddingBottom: 40,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 24,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(150,150,150,0.3)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarBig: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(150,150,150,0.1)'
    },
    avatarTextBig: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#818CF8', // Indigo-400
    },
    email: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    status: {
        fontSize: 14,
        letterSpacing: 0.5,
    },
    togglesRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    toggleBtn: {
        flex: 1,
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    toggleLabel: {
        fontWeight: '600',
    },
    visionPortal: {
        marginBottom: 32,
        borderRadius: 24,
        overflow: 'hidden',
        height: 100,
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    visionGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    visionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
    },
    visionTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    visionSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
    },
    menuGroup: {
        gap: 12,
        marginBottom: 24,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    logoutBtn: {
        alignItems: 'center',
        padding: 16,
    },
    logoutText: {
        color: '#EF4444',
        fontWeight: '600',
    }
});
