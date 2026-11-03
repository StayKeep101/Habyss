// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { applyTheme, cssVars, type ThemeName } from './css';
import { AppIcon } from '../ui/AppIcon';

describe('design tokens', () => {
  it('abyss surfaces and colours are the phone values', () => {
    const v = cssVars('abyss');
    expect(v['--bg']).toBe('#050505'); expect(v['--surface']).toBe('#111113');
    expect(v['--surface-top']).toBe('#18181B'); expect(v['--accent']).toBe('#8EB0FF');
    expect(v['--radius-card']).toBe('22px'); expect(v['--radius-control']).toBe('18px');
    expect(v['--dur-base']).toBe('260ms'); expect(v['--font-body']).toContain('Lexend');
    expect(v['--ease-enter']).toBe('cubic-bezier(0.33,1,0.68,1)');
    expect(v['--shadow-card']).toBe('0 8px 18px rgba(0,0,0,0.45)');
  });
  it('every theme defines the same variable names', () => {
    const keys = (t: ThemeName) => Object.keys(cssVars(t)).sort();
    expect(keys('light')).toEqual(keys('abyss')); expect(keys('trueDark')).toEqual(keys('abyss'));
  });
  it('applyTheme writes variables and data-theme', () => {
    const root = document.createElement('div');
    applyTheme('trueDark', root);
    expect(root.style.getPropertyValue('--surface')).toBe('#101010');
    expect(root.dataset.theme).toBe('trueDark');
  });
  it('AppIcon has an accessible label when given one, and is hidden otherwise', () => {
    const { container, unmount } = render(createElement(AppIcon, { name: 'home', label: 'Home' }));
    expect(screen.getByLabelText('Home')).toBeTruthy();
    unmount();
    const r = render(createElement(AppIcon, { name: 'home' }));
    expect(r.container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(container).toBeTruthy();
  });
});
