# Doing something together

The rules for a shared habit, task or goal. They are written down because every
one of them is a decision that could reasonably have gone the other way, and
code that implements a rule cannot tell you why the other rule was rejected.

## One arrangement, two records

A shared item is copied onto the accepter's device **with the owner's id**, not
a fresh one. That id is what both sides publish completions against —
`shared_completions` is keyed by it — so keeping it is the thing that makes the
two ticks the same tick. A new id would give somebody a private habit that
merely looked like their friend's.

Each person owns their own copy the way they own everything else on their
phone: it syncs to their account, it can be skipped, it can be archived.

## Sharing is an offer, never an arrival

A share writes a `pending` row and tells the other person. It joins their list
only when they accept. Putting your habit into somebody else's day because you
decided to is the same manners as writing in their diary.

Either answer is reported back to whoever asked. Silence after a share is
indistinguishable from the share never arriving.

**Asking again after a refusal works.** A declined row is re-opened to pending
and re-announced. People change their minds, and an app that silently made one
pairing impossible forever — with no way for either side to find out — was
worse than one that lets somebody ask twice. An offer still *waiting* is left
alone: re-sending it only moves it to the top of an inbox, which is nagging.

## Who may change what it is

**Only the person who offered it.**

The alternative has no good answer. If both sides can edit, one of them moves
the habit to 7am and the other is late for something they never agreed to; or
the two copies drift and both people believe they are doing the same thing
while doing different ones. There is no merge that resolves a disagreement
about what a habit *is*.

Everyone on it can still **do** it, **skip** it and **leave** it. Those are
statements about your own day and nobody else's, so they need no permission.

Leaving removes your copy only. The owner keeps theirs, because it was always
theirs — walking away from an arrangement is not deleting somebody else's
habit.

`canEditShared` in `lib/sharedAdopt.ts` is the rule; `lib/__tests__/sharedRules.test.ts`
is what fails if it changes by accident.

## It is not done until everyone has done it

That is the whole point. One you can tick alone is an ordinary item with a
friend's face beside it, and what makes people turn up is knowing somebody is
waiting.

**Except for people who have not answered.** Somebody invited and still
undecided appears on the card — knowing at a glance who this is shared with is
what the faces are for — but is not part of the rule. Counting them would make
an item impossible to finish until a friend replied, which turns a share into a
hostage.

## Streaks stay yours

Deliberately untouched. The row's *claim* is shared; your record is not.

One friend's quiet week ending a streak you kept perfectly is a much heavier
promise than it sounds, and it should be a decision taken on purpose rather than
one that arrives with a feature. Say if it should change.

## What the other person is told

- **Offered** — one thing in their inbox, a card with Accept and No thanks, and
  a push on their phone. Not two: the offer used to arrive as both a card and a
  separate notification saying the same thing, one answerable and one only
  readable.
- **Answered** — the owner is told either way.
- **Half done** — when you finish your side of something today, the people
  waiting are told, if they have that switch on. Only today: being told at
  midnight that somebody finished a Tuesday is not news.
