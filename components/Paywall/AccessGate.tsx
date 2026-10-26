import React from 'react';
import { useAccess } from '@/hooks/useAccess';
import { Paywall } from '@/components/Paywall/Paywall';

/**
 * Over the whole app while it is not open to you: before the free week
 * starts (it says what happens after it), and once it has ended until
 * Habyss is bought. Never when there is no way to pay (lib/access.ts).
 */
export function AccessGate() {
    const { access } = useAccess();
    if (access.kind === 'not_started') return <Paywall mode="start" />;
    if (access.kind === 'ended') return <Paywall mode="ended" />;
    return null;
}
