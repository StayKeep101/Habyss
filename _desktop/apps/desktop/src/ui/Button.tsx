import type { ButtonHTMLAttributes } from 'react';

/**
 * Desktop adaptation: the phone's primary button is 54 tall for touch; on desktop
 * with a pointer the minimum height is 36 (see .ui-btn in ui.css).
 */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger' }) {
  return <button type={type} className={`ui-btn ui-btn-${variant}${className ? ` ${className}` : ''}`} {...rest} />;
}
