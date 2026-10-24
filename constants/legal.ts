/**
 * The privacy policy and terms, shown in the app (app/(root)/legal.tsx) and
 * kept word for word with the website's copies. Written from what the app
 * actually does; change it whenever that changes.
 */
export const LEGAL_UPDATED = 'October 24, 2026';

export type LegalDoc = 'privacy' | 'terms';
export interface LegalSection { title: string; body: string }

export const LEGAL: Record<LegalDoc, { title: string; intro: string; sections: LegalSection[] }> = {
    privacy: {
        title: 'Privacy policy',
        intro: 'Habyss is built to keep your life on your phone. This is everything it collects, why, and what you can do about it.',
        sections: [
            { title: 'On your phone only', body: 'Your habits, tasks, goals, check-ins, brain dump, focus sessions and settings are stored on your device. Sleep read from Apple Health is used only to fill in your sleep habits. Places you save for a reminder (such as Home or Work) are kept with that habit. Echo, the coach, runs on your device; nothing you write is sent to an AI service.' },
            { title: 'When you sign in', body: 'If you create an account, we store your email address, display name, @username, profile photo and bio, and a backup of your habits, tasks, goals and check-ins (including a sleep habit’s progress and the places saved for reminders) so you can restore them and use Habyss on another device. This is kept with Supabase, our database provider.' },
            { title: 'Friends', body: 'If you add friends, they can see your display name, @username, photo, Marks, rank, streak, your daily card (what you did that day) and the habits, tasks and goals you choose to share with them. Your status (focusing, in the app, asleep) is shown only to friends. You can turn off sharing your progress in Settings, and remove or block anyone at any time. The leaderboard shows your name, photo and Marks only to people in your league.' },
            { title: 'Notifications', body: 'To send you reminders and nudges from friends, we store your device’s push notification token.' },
            { title: 'Feedback', body: 'If you send feedback, we store your message with the screen you were on, the app version and your phone’s system version, and email it to the developer so it is read.' },
            { title: 'Crash reports', body: 'If Habyss crashes, a crash report (what went wrong in the code, the app and system version, and your account id if you are signed in) is sent so the bug can be fixed. It never includes what you wrote.' },
            { title: 'Purchases', body: 'Purchases are handled by Apple, through RevenueCat. We never see your card details. RevenueCat receives an anonymous id or your account id so a purchase belongs to you.' },
            { title: 'What we never do', body: 'No ads. No tracking across apps or websites. No selling or sharing your data with anyone for marketing. No analytics tools.' },
            { title: 'Deleting your data', body: 'Settings → Privacy → Delete account removes your account, profile, photo, backup, friends and posts from the server, and everything on this device. Feedback you sent is kept without your name. It cannot be undone.' },
            { title: 'Children', body: 'Habyss is not meant for children under 13, and we do not knowingly collect their data.' },
            { title: 'Changes and contact', body: 'If this policy changes, the new version will appear here with a new date. Questions: send feedback from the app (Settings → Help → Send feedback).' },
        ],
    },
    terms: {
        title: 'Terms',
        intro: 'By using Habyss you agree to these terms. They are short on purpose.',
        sections: [
            { title: 'The app', body: 'Habyss helps you build habits, finish tasks and reach goals. It is provided as is, and features may change or be removed as the app improves.' },
            { title: 'Your account', body: 'Keep your sign-in details to yourself; you are responsible for what is done with your account. Your @username must be yours to use and not impersonate anyone.' },
            { title: 'Be decent', body: 'Do not use Habyss to harass, threaten or spam anyone, or to post anything illegal, hateful or sexual. We may remove content or accounts that break this, and you can report or block anyone.' },
            { title: 'Marks and leaderboards', body: 'Marks and ranks are for motivation and have no money value. We may correct Marks that were earned by cheating or by mistake.' },
            { title: 'Purchases', body: 'Purchases, such as buying the developer a coffee, are processed by Apple under Apple’s terms. A coffee is a one-off tip; it unlocks nothing and is not refundable by us. For refunds, contact Apple.' },
            { title: 'Health', body: 'Habyss is not medical advice. Sleep figures come from Apple Health and are only as accurate as the device that recorded them. Talk to a professional about your health.' },
            { title: 'Liability', body: 'To the extent the law allows, Habyss and its developer are not liable for indirect or consequential losses, or for data lost from your device. Keep a backup by signing in.' },
            { title: 'Ending', body: 'You can stop using Habyss and delete your account at any time. We may suspend accounts that break these terms.' },
            { title: 'Changes', body: 'If these terms change, the new version will appear here with a new date. Using Habyss after that means you accept them.' },
        ],
    },
};
