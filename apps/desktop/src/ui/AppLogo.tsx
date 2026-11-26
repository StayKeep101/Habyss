import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { appColor } from '../analytics';

/** One lookup per app or site for the life of the window; misses are cached too, so a letter badge never refetches. */
const cache = new Map<string, Promise<string | null>>();
function lookup(key: string, load: () => Promise<string | null>): Promise<string | null> {
  let hit = cache.get(key);
  if (!hit) { hit = load().catch(() => null); cache.set(key, hit); }
  return hit;
}
export function useLogo(bundle?: string | null, domain?: string | null): string | null {
  const key = domain ? `site:${domain}` : bundle ? `app:${bundle}` : '';
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(null);
    if (!key || !isTauri()) return;
    let live = true;
    void lookup(key, () => domain ? invoke<string | null>('site_icon', { domain }) : invoke<string | null>('app_icon', { bundle }))
      .then(v => { if (live) setSrc(v); });
    return () => { live = false; };
  }, [key, bundle, domain]);
  return src;
}

/** The real app icon or site favicon, falling back to a tinted initial while it loads or when there is none. */
export function AppLogo({ name, bundle, domain, size = 28 }: { name: string; bundle?: string | null; domain?: string | null; size?: number }) {
  const src = useLogo(bundle, domain);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const style = { width: size, height: size };
  if (src && !broken) return <img className={`app-logo${domain ? ' site' : ''}`} src={src} alt="" aria-hidden="true" style={style} onError={() => setBroken(true)} />;
  const color = appColor(name);
  return <span className="app-logo letter" aria-hidden="true" style={{ ...style, color, background: `${color}1f`, fontSize: Math.round(size * 0.45) }}>{(name.trim()[0] ?? '·').toUpperCase()}</span>;
}
