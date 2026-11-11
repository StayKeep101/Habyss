import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoidShell } from '@/components/ui/VoidShell';
import { ModalHeader } from '@/components/ui/ModalHeader';

type SheetScreenProps = React.ComponentProps<typeof ModalHeader> & { children: React.ReactNode };

/**
 * Routed page sheets and native modals share the same header and safe edges.
 * On iOS every one of them closes by swiping down, so the header carries no
 * back button: the title alone, still centred.
 */
export function SheetScreen({ children, onBack, ...header }: SheetScreenProps) {
    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={Platform.OS === 'ios' ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}>
                <ModalHeader {...header} onBack={Platform.OS === 'ios' ? undefined : onBack} />
                {children}
            </SafeAreaView>
        </VoidShell>
    );
}
