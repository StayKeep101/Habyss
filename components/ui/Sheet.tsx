import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { AppIcon } from '@/components/Common/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { palette } from '@/theme/tokens';
import { Text } from './Text';

export interface SheetProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** `sheet` rises from the bottom; `dialog` is a small window in the middle. */
    variant?: 'sheet' | 'dialog';
}

/** Anything that appears over a screen: a bottom sheet or a small window. */
export function Sheet({ visible, onClose, title, children, variant = 'sheet' }: SheetProps) {
    const t = useTokens();
    const dialog = variant === 'dialog';
    return (
        <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
            <View style={{ flex: 1, justifyContent: dialog ? 'center' : 'flex-end', padding: dialog ? t.space.xl : 0 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.tint('border', t.theme === 'light' ? t.color.textPrimary : palette.black) }} />
                <View style={{
                    maxHeight: '85%',
                    backgroundColor: t.color.background,
                    borderRadius: t.radius.lg,
                    borderBottomLeftRadius: dialog ? t.radius.lg : 0,
                    borderBottomRightRadius: dialog ? t.radius.lg : 0,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    paddingTop: t.space.lg,
                    ...t.elevation('floating'),
                }}>
                    {title ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.space.xl, paddingBottom: t.space.sm }}>
                            <Text variant="title">{title}</Text>
                            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={t.space.md} onPress={onClose}>
                                <AppIcon name="close" size={t.space.xl} color={t.color.textMuted} />
                            </Pressable>
                        </View>
                    ) : null}
                    <ScrollView contentContainerStyle={{ paddingHorizontal: t.space.xl, paddingBottom: t.space['2xl'], gap: t.space.md }} showsVerticalScrollIndicator={false}>
                        {children}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
