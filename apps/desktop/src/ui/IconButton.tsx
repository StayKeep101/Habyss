import { AppIcon, type IconName } from './AppIcon';

/** The label is required: it is the accessible name. The hit target is at least 44px. */
export function IconButton({ icon, label, onClick, filled = false }: { icon: IconName; label: string; onClick: () => void; filled?: boolean }) {
  return <button type="button" className="ui-iconbtn" aria-label={label} title={label} onClick={onClick}><AppIcon name={icon} filled={filled} /></button>;
}
