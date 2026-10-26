import { useEffect, useState } from 'react';
import { cacheImage, cachedNow } from '@/lib/imageCache';

/** A picture's phone copy when there is one (lib/imageCache.ts), fetched once in the background. */
export function useCachedImage(uri: string | null | undefined): string | null {
    const [shown, setShown] = useState(() => cachedNow(uri));
    useEffect(() => {
        setShown(cachedNow(uri));
        if (!uri) return;
        let alive = true;
        void cacheImage(uri).then(local => { if (alive) setShown(local); });
        return () => { alive = false; };
    }, [uri]);
    return shown;
}
