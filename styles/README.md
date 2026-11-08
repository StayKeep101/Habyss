# Screen styles

Every page's look lives here, one file per page, taken out of the page exactly as it was: same values, nothing changed on screen. The page files in `app/` now only hold what the page does.

To bring a page in line with the design system, open its file here and swap its raw numbers and colours for tokens from `theme/tokens.ts`, one page at a time.

| Page | Style file |
|---|---|
| `app/(root)/account.tsx` | `styles/screens/account.styles.ts` |
| `app/(root)/add-friend.tsx` | `styles/screens/add-friend.styles.ts` |
| `app/(root)/ai-config.tsx` | `styles/screens/ai-config.styles.ts` |
| `app/(root)/ai-settings.tsx` | `styles/screens/ai-settings.styles.ts` |
| `app/(root)/all-habits.tsx` | `styles/screens/all-habits.styles.ts` |
| `app/(root)/appearance.tsx` | `styles/screens/appearance.styles.ts` |
| `app/(root)/plus-button.tsx` | `styles/screens/plus-button.styles.ts` |
| `app/(auth)/onboarding.tsx` | none: The Ascent draws itself (`components/Ascent/`) |
| `app/(root)/blocked.tsx` | `styles/screens/blocked.styles.ts` |
| `app/(root)/goal-detail.tsx` | `styles/screens/goal-detail.styles.ts` |
| `app/(root)/goal-roadmap.tsx` | `styles/screens/goal-roadmap.styles.ts` |
| `app/(root)/goals-overview.tsx` | `styles/screens/goals-overview.styles.ts` |
| `app/(root)/habit-detail.tsx` | `styles/screens/habit-detail.styles.ts` |
| `app/(root)/help.tsx` | `styles/screens/help.styles.ts` |
| `app/(root)/inbox.tsx` | `styles/screens/inbox.styles.ts` |
| `app/(root)/integrations.tsx` | `styles/screens/integrations.styles.ts` |
| `app/+not-found.tsx` | `styles/screens/not-found.styles.ts` |
| `app/(root)/notifications.tsx` | `styles/screens/notifications.styles.ts` |
| `app/(root)/privacy.tsx` | `styles/screens/privacy.styles.ts` |
| `app/(root)/profile.tsx` | `styles/screens/profile.styles.ts` |
| `app/(root)/progress.tsx` | `styles/screens/progress.styles.ts` |
| `app/(root)/sharing.tsx` | `styles/screens/sharing.styles.ts` |
| `app/(root)/(tabs)/community.tsx` | `styles/screens/tabs/community.styles.ts` |
| `app/(root)/(tabs)/roadmap.tsx` | `styles/screens/tabs/roadmap.styles.ts` |
| `app/(root)/(tabs)/settings.tsx` | `styles/screens/tabs/settings.styles.ts` |
| `app/(root)/task-stats.tsx` | `styles/screens/task-stats.styles.ts` |
| `app/(root)/ui-catalog.tsx` | `styles/screens/ui-catalog.styles.ts` |

Home, Paywall, Goal stats and Goal plan have no page-level styles: they are built entirely from components (`components/Home`, `components/Goal`, …), so their look lives in those components.
| `app/(root)/guide.tsx` | `styles/screens/guide.styles.ts` |
| `app/(root)/legal.tsx` | `styles/screens/legal.styles.ts` |
| `app/(root)/echo-memory.tsx` | `styles/screens/echo-memory.styles.ts` |
| `app/(root)/week-review.tsx` | `styles/screens/week-review.styles.ts` |
| `app/(root)/developer.tsx` | `styles/screens/developer.styles.ts` |
| `app/(root)/brain-dump.tsx` | `styles/screens/brain-dump.styles.ts` |
| `app/(root)/friend.tsx` | `styles/screens/friend.styles.ts` |
| `app/(root)/leaderboard.tsx` | `styles/screens/leaderboard.styles.ts` |
| `app/(root)/ranks.tsx` | `styles/screens/ranks.styles.ts` |
| `app/(root)/focus-stats.tsx` | `styles/screens/focus-stats.styles.ts` |
| `app/(root)/meals.tsx` | `styles/screens/meals.styles.ts` |
