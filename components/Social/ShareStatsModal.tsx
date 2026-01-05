import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Share, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { LinearGradient } from 'expo-linear-gradient';

interface ShareStatsModalProps {
    visible: boolean;
    onClose: () => void;
    stats: {
        title: string;
        value: string;
        subtitle: string;
        type: 'growth' | 'streak' | 'consistency';
    };
}

const FUNNY_PHRASES = [
    "Flexing on main.",
    "Humble brag.",
    "Just getting started 🚀",
    "Consistency is key 🔑",
    "Stats don't lie.",
    "Built different.",
    "Witness me.",
    "Leveling up IRL.",
    "No days off (almost).",
    "Main character energy."
];

export const ShareStatsModal: React.FC<ShareStatsModalProps> = ({ visible, onClose, stats }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [phrase, setPhrase] = useState(FUNNY_PHRASES[0]);

    useEffect(() => {
        if (visible) {
            setPhrase(FUNNY_PHRASES[Math.floor(Math.random() * FUNNY_PHRASES.length)]);
        }
    }, [visible]);

    const cyclePhrase = () => {
        let newPhrase = phrase;
        while (newPhrase === phrase) {
            newPhrase = FUNNY_PHRASES[Math.floor(Math.random() * FUNNY_PHRASES.length)];
        }
        setPhrase(newPhrase);
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out my stats on Habyss:\n\n${stats.title}: ${stats.value}\n${stats.subtitle}\n\n"${phrase}"\n\n#Habyss #Growth`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

                <View style={styles.container}>
                    <Text style={styles.header}>SHARE YOUR WINS</Text>

                    <VoidCard glass style={styles.card}>
                        <LinearGradient
                            colors={stats.type === 'streak' ? ['#F97316', '#EF4444'] : stats.type === 'consistency' ? ['#10B981', '#059669'] : ['#3B82F6', '#8B5CF6']}
                            style={styles.gradientBg}
                        />

                        <View style={styles.content}>
                            <View style={styles.logoContainer}>
                                <Ionicons name="rocket" size={24} color="#fff" />
                            </View>

                            <Text style={styles.statValue}>{stats.value}</Text>
                            <Text style={styles.statTitle}>{stats.title}</Text>
                            <Text style={styles.statSub}>{stats.subtitle}</Text>

                            <TouchableOpacity onPress={cyclePhrase} style={styles.phraseBox}>
                                <Text style={styles.phraseText}>"{phrase}"</Text>
                                <Ionicons name="refresh" size={12} color="rgba(255,255,255,0.5)" style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        </View>
                    </VoidCard>

                    <View style={styles.actions}>
                        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
                            <Ionicons name="share-outline" size={20} color="white" />
                            <Text style={styles.shareText}>Share Image</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    container: { width: '100%', maxWidth: 340, alignItems: 'center' },
    header: { color: 'white', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, marginBottom: 20, fontFamily: 'Lexend_400Regular' },
    card: { width: '100%', aspectRatio: 4 / 5, borderRadius: 24, overflow: 'hidden', padding: 0 },
    gradientBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15 },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    logoContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    statValue: { fontSize: 56, fontWeight: '900', color: '#fff', fontFamily: 'Lexend', textAlign: 'center' },
    statTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 1, marginTop: 4, fontFamily: 'Lexend' },
    statSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8, fontFamily: 'Lexend_400Regular' },
    phraseBox: { flexDirection: 'row', alignItems: 'center', marginTop: 40, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
    phraseText: { color: '#fff', fontStyle: 'italic', fontSize: 14, fontFamily: 'Lexend_300Light' },
    actions: { flexDirection: 'row', gap: 12, marginTop: 30, width: '100%' },
    cancelBtn: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
    cancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
    shareBtn: { flex: 2, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 8 },
    shareText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});
