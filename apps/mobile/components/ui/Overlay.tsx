import React, { useEffect } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

/**
 * A layer over the whole app (a menu, a celebration) without presenting a
 * second window. A React Native Modal presents one; over a page that is
 * itself a modal that froze the app, and opened mid-scroll it blanked the
 * page under it for a moment. This draws on top instead, over every page,
 * sheets included. Android's back button closes it, as a modal's would.
 */
export function Overlay({ children, onRequestClose }: { children: React.ReactNode; onRequestClose?: () => void }) {
    useEffect(() => {
        if (Platform.OS !== 'android' || !onRequestClose) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => { onRequestClose(); return true; });
        return () => sub.remove();
    }, [onRequestClose]);
    if (Platform.OS === 'ios') return <FullWindowOverlay>{children}</FullWindowOverlay>;
    return <View style={styles.fill} pointerEvents="box-none">{children}</View>;
}

const styles = StyleSheet.create({
    fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 1000 },
});
