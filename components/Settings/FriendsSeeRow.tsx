import React, { useEffect, useState } from 'react';
import { SettingsRow } from '@/components/ui/SettingsList';
import { useHaptics } from '@/hooks/useHaptics';
import { getSharing, setSharing, type Sharing } from '@/lib/profileSync';

/**
 * One thing friends can see of you, as a switch (lib/profileSync.ts): the same
 * setting wherever it is shown. Turning it off takes it off the server too.
 */
export function FriendsSeeRow({ what, icon, color, label }: { what: keyof Sharing; icon: string; color: string; label: string }) {
    const { selectionFeedback } = useHaptics();
    const [on, setOn] = useState<boolean | null>(null);
    useEffect(() => {
        let alive = true;
        void getSharing().then(found => { if (alive) setOn(found[what]); }).catch(() => undefined);
        return () => { alive = false; };
    }, [what]);
    const flip = (value: boolean) => {
        selectionFeedback();
        setOn(value);
        void setSharing({ [what]: value }).then(found => setOn(found[what])).catch(() => setOn(!value));
    };
    return <SettingsRow icon={icon} color={color} label={label} toggle={on ?? true} disabled={on === null} onToggle={flip} />;
}
