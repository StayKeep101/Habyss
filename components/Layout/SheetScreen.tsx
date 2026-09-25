import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoidShell } from './VoidShell';
import { ModalHeader } from './ModalHeader';

type SheetScreenProps = React.ComponentProps<typeof ModalHeader> & { children: React.ReactNode };

/** Routed page sheets and native modals share the same header and safe edges. */
export function SheetScreen({ children, ...header }: SheetScreenProps) {
    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={Platform.OS === 'ios' ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}>
                <ModalHeader {...header} />
                {children}
            </SafeAreaView>
        </VoidShell>
    );
}
