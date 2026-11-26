import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { emit } from '@/lib/appEvents';

/**
 * `habyss://add?kind=task` (or `habit`, `braindump`): where the widget's + lands.
 *
 * A widget cannot hold a text field, so the nearest thing to typing into it is
 * one tap to a keyboard: this goes Home and opens the composer straight away.
 * The sheets live in the root layout, so they are there to answer even on a
 * cold launch.
 */
export default function QuickAdd() {
    const router = useRouter();
    const { kind } = useLocalSearchParams<{ kind?: string }>();

    useEffect(() => {
        // Brain dump is a page of its own: straight there, keyboard up.
        if (kind === 'braindump') { router.replace('/brain-dump' as never); return; }
        router.replace('/');
        // After the replace has settled, so the sheet opens over Home.
        setTimeout(() => {
            if (kind === 'habit') emit('show_quick_add', undefined);
            else emit('show_task_form', undefined);
        }, 450);
    }, [kind, router]);

    return null;
}
