import React from 'react';
import { ScrollView } from 'react-native';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { UIStyles } from '@/theme/designSystem';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose, title, children }) => (
    <VoidModal visible={visible} onClose={onClose}>
        <ModalHeader title={title} />
        <ScrollView contentContainerStyle={UIStyles.screenContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
        </ScrollView>
    </VoidModal>
);
