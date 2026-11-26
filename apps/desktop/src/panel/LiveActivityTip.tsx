import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

const KEY = 'habyss.liveActivityTip';
const seen = () => { try { return localStorage.getItem(KEY) === 'dismissed'; } catch { return false; } };

/** macOS shows iPhone Live Activities in the menu bar too; no app can hide another device's. One line, once, to hide it here. */
export function LiveActivityTip() {
  const [hidden, setHidden] = useState(seen);
  if (hidden) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, 'dismissed'); } catch { /* shows again next time */ } };
  return (
    <aside className="mp-tip" aria-label="Tip">
      <p>Seeing Habyss twice? Hide the iPhone one on this Mac: Menu Bar → Live Activities → Habyss <span>(macOS 27.3 and later; before that, Notifications → Allow notifications from iPhone)</span>.</p>
      <button type="button" className="mp-chip" onClick={() => void invoke('open_system_settings', { pane: 'menu_bar' }).catch(() => undefined)}>Open Menu Bar settings</button>
      <button type="button" className="mp-chip" onClick={dismiss}>Dismiss</button>
    </aside>
  );
}
