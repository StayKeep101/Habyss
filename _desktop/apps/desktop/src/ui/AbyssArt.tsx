/** Decorative eclipse over a dark mountain ridge. Resolution independent, hidden from assistive tech. */
export function AbyssArt({ size }: { size: 'hero' | 'badge' }) {
  const id = `abyss-${size}`;
  return (
    <svg className={`ui-abyss ui-abyss-${size}`} viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-disc`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#050507" /><stop offset="0.85" stopColor="#07080d" /><stop offset="1" stopColor="#0d1020" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0.1" y1="0.9" x2="0.9" y2="0.1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.35" stopColor="#bcd0ff" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#9fb8ff" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1d29" /><stop offset="1" stopColor="#07080b" />
        </linearGradient>
        <linearGradient id={`${id}-near`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101218" /><stop offset="1" stopColor="#030304" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8EB0FF" stopOpacity="0" /><stop offset="0.5" stopColor="#c9d7ff" stopOpacity="0.5" /><stop offset="1" stopColor="#8EB0FF" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5" /></filter>
        <filter id={`${id}-halo`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14" /></filter>
        <filter id={`${id}-soft`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.6" /></filter>
      </defs>
      <circle cx="210" cy="82" r="66" fill="#8EB0FF" opacity="0.14" filter={`url(#${id}-halo)`} />
      <circle cx="210" cy="82" r="62" fill={`url(#${id}-disc)`} />
      <path d="M 154 108 A 62 62 0 0 1 238 24" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="5" strokeLinecap="round" opacity="0.85" filter={`url(#${id}-glow)`} />
      <path d="M 154 108 A 62 62 0 0 1 238 24" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M0 150 L38 136 L70 146 L112 120 L150 138 L196 112 L240 134 L286 104 L330 128 L366 114 L400 126 V200 H0 Z" fill={`url(#${id}-far)`} />
      <path d="M196 112 L240 134 M286 104 L330 128 M112 120 L150 138" stroke={`url(#${id}-edge)`} strokeWidth="1" fill="none" opacity="0.55" filter={`url(#${id}-soft)`} />
      <path d="M0 172 L46 158 L92 170 L140 148 L188 168 L236 144 L284 164 L332 140 L372 156 L400 148 V200 H0 Z" fill={`url(#${id}-near)`} />
      <path d="M140 148 L188 168 M236 144 L284 164 M332 140 L372 156" stroke={`url(#${id}-edge)`} strokeWidth="0.8" fill="none" opacity="0.4" />
    </svg>
  );
}
