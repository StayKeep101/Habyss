import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SpinningLogo } from '@/components/SpinningLogo';
import { APP_NAME, APP_SLOGAN } from '@/constants/brand';

interface HabyssBootScreenProps {
    subtitle?: string;
}

export const HabyssBootScreen: React.FC<HabyssBootScreenProps> = ({
    subtitle = 'Reassembling your local universe',
}) => {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#030712', '#0A1020', '#04060B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.orbitLarge} />
            <View style={styles.orbitSmall} />
            <View style={styles.content}>
                <SpinningLogo size={112} glow />
                <Text style={styles.title}>{APP_NAME}</Text>
                <Text style={styles.slogan}>{APP_SLOGAN}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#030712',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    title: {
        marginTop: 24,
        color: '#F8FAFC',
        fontSize: 34,
        letterSpacing: 8,
        fontFamily: 'SpaceGrotesk_700Bold',
    },
    slogan: {
        marginTop: 12,
        color: 'rgba(226,232,240,0.92)',
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: 0.3,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 18,
        color: 'rgba(226,232,240,0.55)',
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
    },
    orbitLarge: {
        position: 'absolute',
        width: 320,
        height: 320,
        borderRadius: 160,
        borderWidth: 1,
        borderColor: 'rgba(139, 173, 214, 0.12)',
    },
    orbitSmall: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        borderWidth: 1,
        borderColor: 'rgba(58, 90, 140, 0.16)',
    },
});
