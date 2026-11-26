/** The panel's left edge: centred under the menu bar icon, kept `margin` px inside the display it opens on. Mirrored in src-tauri/src/lib.rs. */
export function panelX(iconCenter: number, width: number, monitorLeft: number, monitorRight: number, margin = 8): number {
  const centred = iconCenter - width / 2;
  return Math.max(monitorLeft + margin, Math.min(centred, monitorRight - margin - width));
}
