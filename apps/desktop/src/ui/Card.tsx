import type { ReactNode } from 'react';

/** The matte surface: vertical gradient, 1px lip, card radius and shadow. */
export function Card({ title, action, aside, children, className }: { title?: ReactNode; action?: ReactNode; aside?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`ui-card${className ? ` ${className}` : ''}`}>
      {(title || action || aside) && (
        <header className="ui-card-head">
          <h2 className="ui-card-title">{title}{aside && <span className="ui-card-aside">{aside}</span>}</h2>
          {action && <div className="ui-card-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
