import { AppIcon, type IconName } from './AppIcon';

export function StatTile({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <div className="ui-stat">
      <span className="ui-stat-icon"><AppIcon name={icon} size={28} /></span>
      <div className="ui-stat-body">
        <div className="ui-stat-value">{value}</div>
        <div className="ui-stat-label">{label}</div>
      </div>
    </div>
  );
}
