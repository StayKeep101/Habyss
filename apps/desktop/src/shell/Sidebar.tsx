import type { Act, Screen, Snapshot, SyncStatus } from '../types';
import { AbyssArt, AppIcon, type IconName } from '../ui';

export const TABS: { screen: Screen; icon: IconName }[] = [
  { screen: 'Dashboard', icon: 'home' }, { screen: 'Calendar', icon: 'calendar' }, { screen: 'Analytics', icon: 'stats-chart' },
  { screen: 'Profile', icon: 'person' }, { screen: 'Settings', icon: 'settings' },
];
const DIVIDER_BEFORE: Screen = 'Profile';
const syncTone = (state: string) => (state === 'idle' || state === 'syncing' ? 'on' : state === 'offline' ? 'warn' : state === 'error' ? 'bad' : '');

export function Sidebar({ screen, onSelect, data, busy, act, sync }: { screen: Screen; onSelect: (s: Screen) => void; data: Snapshot; busy: boolean; act: Act; sync: SyncStatus | null }) {
  const tracking = data.settings.tracking_enabled;
  const status = data.error ? 'Tracking error' : tracking ? data.state.replaceAll('_', ' ') : 'Paused';
  return (
    <aside className="app-sidebar">
      <div data-tauri-drag-region className="app-drag" />
      <div className="app-brand"><AppIcon name="hourglass" size={26} filled />Habyss</div>
      <nav aria-label="Main">
        {TABS.map(t => (
          <div key={t.screen} className="app-nav-item">
            {t.screen === DIVIDER_BEFORE && <hr className="app-nav-divider" />}
            <button type="button" className={screen === t.screen ? 'selected' : ''} aria-current={screen === t.screen ? 'page' : undefined} onClick={() => onSelect(t.screen)}>
              <AppIcon name={t.icon} size={22} filled={screen === t.screen} />{t.screen}
            </button>
          </div>
        ))}
      </nav>
      <div className="app-foot">
        <div className="app-abyss"><AbyssArt size="badge" /></div>
        <p className="app-foot-title">The Abyss</p>
        <p className="app-foot-sub">Rise Higher.</p>
        <div className="app-track">
          <button type="button" className="app-track-btn" disabled={busy} onClick={() => void act('set_tracking', { enabled: !tracking })}>
            <AppIcon name={tracking ? 'pause' : 'play'} size={15} />{tracking ? 'Pause tracking' : 'Resume tracking'}
            <span className={`app-status ${tracking ? 'on' : ''}`}><i />{status}</span>
          </button>
          {sync && sync.state !== 'unconfigured' && <span className={`app-sync ${syncTone(sync.state)}`} role="img" aria-label={`Sync: ${sync.state.replaceAll('_', ' ')}`} title={`Sync: ${sync.state.replaceAll('_', ' ')}`}><i /></span>}
        </div>
        <small className="app-version">Habyss {data.version} · ⌘, for settings</small>
      </div>
    </aside>
  );
}
