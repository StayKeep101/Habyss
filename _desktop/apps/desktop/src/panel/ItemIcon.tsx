import * as Io from 'react-icons/io5';
import type { IconType } from 'react-icons';
import type { ItemKind } from '../today/today';

const FALLBACK: Record<ItemKind, string> = { habit: 'ellipse', task: 'checkbox', meal: 'restaurant', event: 'calendar' };
const pascal = (name: string) => name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

/** The phone's item icon (an Ionicons name like "walk-outline"), filled, or the kind's own when the name is unknown. */
export function ItemIcon({ name, kind, size = 18 }: { name?: string; kind: ItemKind; size?: number }) {
  const icons = Io as unknown as Record<string, IconType>;
  const base = (name ?? '').replace(/-(outline|sharp)$/, '');
  const Icon = icons[`Io${pascal(base)}`] ?? icons[`Io${pascal(FALLBACK[kind])}`] ?? Io.IoEllipse;
  return <Icon size={size} aria-hidden="true" />;
}
