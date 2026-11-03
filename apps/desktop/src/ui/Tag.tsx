const TAGS = { productive: 'Productive', unproductive: 'Unproductive', neutral: 'Neutral' } as const;

export function Tag({ tone }: { tone: keyof typeof TAGS }) {
  return <span className={`ui-tag ui-tag-${tone}`}>{TAGS[tone]}</span>;
}
