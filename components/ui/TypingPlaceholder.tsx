import React, { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { placeholderAt, TYPE_MS } from '@/lib/typingPlaceholder';

/**
 * A text box's placeholder that types out examples, one after another, for a
 * little inspiration. Wrap the input and pass it the placeholder:
 *
 *   <TypingPlaceholder examples={[…]} active={!text}>
 *       {placeholder => <MatteInput placeholder={placeholder} … />}
 *   </TypingPlaceholder>
 *
 * Only this wrapper and the input redraw as it types, never the whole sheet.
 * It stops while there is text, and shows the first example still when the
 * phone asks for reduced motion.
 */
export function TypingPlaceholder({ examples, active = true, children }: {
    examples: string[];
    active?: boolean;
    children: (placeholder: string) => React.ReactElement;
}) {
    const [reduce, setReduce] = useState(false);
    const [text, setText] = useState(examples[0]?.slice(0, 1) ?? '');

    useEffect(() => {
        let alive = true;
        AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduce(value); }).catch(() => undefined);
        return () => { alive = false; };
    }, []);

    const key = examples.join('\u0000');
    useEffect(() => {
        if (!active || reduce) return;
        const started = Date.now();
        const timer = setInterval(() => setText(placeholderAt(examples, Date.now() - started)), TYPE_MS / 2);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, reduce, key]);

    return children(reduce ? examples[0] ?? '' : text);
}
