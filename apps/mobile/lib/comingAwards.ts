/**
 * Awards still on their way, shown on the Awards page as "Soon" so the list
 * is there to look forward to. Each is earned from what the app already
 * counts; none can be earned yet.
 */
export interface ComingAward { id: string; icon: string; name: string; what: string }

export const COMING_AWARDS: ComingAward[] = [
    { id: 'first-week', icon: 'calendar', name: 'First week', what: 'Seven days in a row' },
    { id: 'month', icon: 'calendar-number', name: 'A month strong', what: 'Thirty days in a row' },
    { id: 'hundred', icon: 'flame', name: 'Hundred', what: 'A 100-day streak' },
    { id: 'perfect-week', icon: 'sparkles', name: 'Perfect week', what: 'Seven perfect days in a row' },
    { id: 'deep-work', icon: 'hourglass', name: 'Deep work', what: '100 hours of focus' },
    { id: 'marathon', icon: 'timer', name: 'Marathon', what: 'Four hours of focus in one day' },
    { id: 'early', icon: 'sunny', name: 'Early riser', what: 'Your first task done before 8 am, ten days' },
    { id: 'rested', icon: 'moon', name: 'Well rested', what: 'Your sleep goal, fourteen nights' },
    { id: 'mover', icon: 'walk', name: 'Mover', what: 'Your exercise goal, thirty days' },
    { id: 'comeback', icon: 'refresh', name: 'Comeback', what: 'Back on track after a missed day, ten times' },
    { id: 'clear-head', icon: 'bulb', name: 'Clear head', what: '100 thoughts sorted from the brain dump' },
    { id: 'crew', icon: 'people', name: 'Crew', what: 'Focus with a friend twenty times' },
    { id: 'cheer', icon: 'heart', name: 'Cheerleader', what: 'React to 100 friends’ days' },
    { id: 'journal', icon: 'book', name: 'Storyteller', what: 'A note on your day, thirty times' },
    { id: 'challenger', icon: 'trophy', name: 'Challenger', what: 'Win ten challenges' },
    { id: 'shards', icon: 'diamond', name: 'Treasury', what: '10,000 Shards at once' },
];
