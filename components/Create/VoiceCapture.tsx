import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { readVoice } from '@/lib/voiceIntent';
import { cleanSpeech, tidySpeech } from '@/lib/voiceClean';
import { getVoiceDestination } from '@/lib/voiceDestination';
import { addThought } from '@/lib/brainDump';
import { normaliseLevel, voiceLevel } from '@/lib/voiceLevel';
import { speechOptions, Transcript } from '@/lib/speechOptions';
import { planFromSpeech, type VoiceItem } from '@/lib/voicePlan';
import { DEFAULT_LENGTH } from '@/lib/dayFlow';
import { VoicePlanSheet } from './VoicePlanSheet';

type Speech = typeof import('expo-speech-recognition')['ExpoSpeechRecognitionModule'];

/**
 * The native speech module, or null on a build made before it was added —
 * there, holding the button simply does nothing rather than crashing.
 */
function speech(): Speech | null {
    try {
        const module = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
        return module.ExpoSpeechRecognitionModule ?? null;
    } catch {
        return null;
    }
}

/**
 * Listens while the create button is held, and acts when it is let go.
 *
 * Hold and speak; release, and the words go where Settings says. Auto (the
 * default): speak freely, and the tasks, habits and goals in it are worked
 * out (lib/voicePlan.ts). One thing opens its own sheet, filled in; several
 * are shown together to add at once (tasks right away, each habit and goal
 * opening ready to save, one after the other). Or always one place: a
 * thought in the brain dump, or a task, habit or goal sheet.
 *
 * The button morphs into the listening pill (components/TabBar/VoiceOrb.tsx)
 * from the `voice_state` it announces; the only thing drawn here is the
 * "Here's what I heard" sheet.
 */
export function VoiceCapture() {
    const [heard, setHeard] = useState<VoiceItem[] | null>(null);

    // Habits and goals still to open, one sheet at a time.
    const queue = useRef<VoiceItem[]>([]);
    const { mediumFeedback, lightFeedback } = useHaptics();
    const latest = useRef('');
    const transcript = useRef(new Transcript()).current;
    const active = useRef(false);
    /** Let go before the microphone was even ready: stop as soon as it is. */
    const releasedEarly = useRef(false);

    /**
     * Words, typed or said, worked out into what they are: a thought (an idea,
     * nothing to do yet) goes to the brain dump; one thing opens its own sheet
     * filled in; several are shown together. Typing and speaking agree because
     * they are the same path.
     */
    const route = async (raw: string) => {
        if (isThought(raw)) {
            await addThought(cleanSpeech(raw) || raw);
            return;
        }
        const items = await planFromSpeech(raw);
        if (!items.length) { await addThought(raw); return; }
        setTimeout(() => { if (items.length === 1) openItem(items[0]); else setHeard(items); }, 220);
    };
    const routeRef = useRef(route);
    routeRef.current = route;


    useEffect(() => {
        const module = speech();
        if (!module) return;

        const finish = () => {
            if (!active.current) return;
            active.current = false;
            voiceLevel.value = 0;
            emit('voice_state', { listening: false, heard: '' });
            const raw = latest.current.trim();
            if (!raw) return;
            lightFeedback();
            // Fillers out (and, with Apple's model, a ramble condensed), then
            // where it goes is the person's choice in Settings (Brain dump by
            // default). "Create a task to…" is still tidied off the front.
            void getVoiceDestination().then(async destination => {
                if (destination === 'auto') { await routeRef.current(raw); return; }
                const spoken = await tidySpeech(raw);
                if (!spoken) return;
                const text = readVoice(spoken)?.text ?? spoken;
                // A beat, so the pill has folded back into the button first.
                setTimeout(() => {
                    if (destination === 'thought') {
                        void addThought(spoken).then(() => require('expo-router').router.push('/brain-dump'));
                    } else if (destination === 'habit') emit('show_quick_add', { prefillName: text });
                    else emit('show_task_form', { prefill: text });
                }, 220);
            });
        };

        const listeners = [
            // Only its own sessions: a text field dictating (useDictation) shares
            // the same speech module and must not open the + button's pill.
            module.addListener('result', event => {
                if (!active.current) return;
                latest.current = transcript.push(event);
                emit('voice_state', { listening: true, heard: latest.current });
            }),
            module.addListener('volumechange', event => { if (active.current) voiceLevel.value = normaliseLevel(event.value); }),
            module.addListener('end', finish),
            module.addListener('error', event => {
                // Letting go before anything was said is not an error worth a word.
                if (event.error !== 'no-speech' && event.error !== 'aborted') console.warn('[Voice]', event.error, event.message);
                finish();
            }),
        ];

        const start = on('voice_start', async () => {
            releasedEarly.current = false;
            latest.current = '';
            transcript.reset();
            emit('voice_state', { listening: true, heard: '' });
            const permission = await module.requestPermissionsAsync().catch(() => null);
            if (!permission?.granted) {
                emit('voice_state', { listening: false, heard: '' });
                Alert.alert('Microphone is off', 'Allow the microphone and speech recognition for Habyss in Settings to create by voice.');
                return;
            }
            // The permission sheet takes the finger away; nothing to listen to.
            if (releasedEarly.current) { emit('voice_state', { listening: false, heard: '' }); return; }
            mediumFeedback();
            active.current = true;
            module.start(await speechOptions({ punctuation: false, levels: true }));
        });
        const stop = on('voice_stop', () => {
            if (!active.current) { releasedEarly.current = true; emit('voice_state', { listening: false, heard: '' }); return; }
            // Stop asks for the final words; 'end' then opens the sheet.
            module.stop();
        });

        // A habit or goal sheet from the list closed: the next one opens.
        const next = on('creation_sheet_closed', () => {
            const following = queue.current.shift();
            if (following) setTimeout(() => openItem(following), 350);
        });

        return () => {
            listeners.forEach(listener => listener.remove());
            start.remove();
            stop.remove();
            next.remove();
        };
    }, [lightFeedback, mediumFeedback]);

    /** Everything heard, added: tasks now; habits and goals open one at a time, ready to save. */
    const addAll = (items: VoiceItem[]) => {
        setHeard(null);
        const tasks = items.filter(item => item.kind === 'task');
        void Promise.all(tasks.map(item => addTask(item.text))).then(() => emit('tasks_changed'));
        queue.current = items.filter(item => item.kind !== 'task');
        const first = queue.current.shift();
        if (first) setTimeout(() => openItem(first), 350);
    };
    /** Closed without adding: kept in the brain dump, so nothing said is lost. */
    const keep = (items: VoiceItem[]) => {
        setHeard(null);
        void Promise.all(items.map(item => addThought(item.text)));
    };

    return heard ? <VoicePlanSheet items={heard} onAdd={addAll} onKeep={keep} /> : null;
}

/** An idea rather than something to do: kept as a thought. */
const THOUGHT = /^(?:idea|thought|note|maybe|what if|i wonder|i think|i feel|remember that)\b/i;
export const isThought = (text: string): boolean => THOUGHT.test(text.trim());

/** One thing heard, in its own sheet with the words already in it. */
function openItem(item: VoiceItem) {
    if (item.kind === 'habit') emit('show_quick_add', { prefillName: item.text });
    else emit('show_task_form', { prefill: item.text });
}

/** A task straight from words, read the way the task sheet reads them (lib/taskParser.ts). */
async function addTask(text: string): Promise<void> {
    const { parseTaskText } = require('@/lib/taskParser') as typeof import('@/lib/taskParser');
    const { createTask } = require('@/lib/tasks') as typeof import('@/lib/tasks');
    const { localDateKey } = require('@/lib/habitSchedule') as typeof import('@/lib/habitSchedule');
    const parsed = parseTaskText(cleanSpeech(text));
    const dueDate = parsed.dueDate ?? localDateKey(new Date());
    await createTask({
        title: parsed.title || text,
        dueDate,
        deadline: parsed.deadline && parsed.deadline > dueDate ? parsed.deadline : undefined,
        dueTime: parsed.dueTime,
        flexible: parsed.dueTime ? parsed.flexible !== false : undefined,
        estimatedMinutes: parsed.estimatedMinutes ?? DEFAULT_LENGTH.task,
        priority: parsed.priority,
        difficulty: parsed.difficulty,
    }).catch(() => null);
}
