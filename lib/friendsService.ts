import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { addHabit, getCompletions, getGoals, getHabits, getLastNDaysCompletions, getStreakData, Habit } from './habitsSQLite';
import { getLocalUserId } from './localUser';

export type ReactionType = 'fire' | 'clap' | 'heart' | 'star' | 'muscle';

export interface Friend {
    id: string;
    userId: string;
    username: string;
    email?: string;
    avatarUrl?: string;
    streak?: number;
    currentStreak?: number;
    bestStreak?: number;
    todayCompleted?: number;
    todayCompletion?: number;
    todayTotal?: number;
    weeklyActivity?: number[];
    isCurrentUser?: boolean;
}

export interface FriendRequest {
    id: string;
    fromUserId: string;
    fromUsername: string;
    fromAvatarUrl?: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
}

export interface FriendActivity {
    id: string;
    userId: string;
    username: string;
    type: string;
    message: string;
    createdAt: string;
    reactions?: Record<string, number>;
}

type ShareStatus = 'pending' | 'accepted' | 'declined';

interface SocialUserRecord {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
    currentStreak: number;
    bestStreak: number;
    completedToday: number;
    totalToday: number;
    weeklyActivity: number[];
    totalHabits: number;
    totalGoals: number;
}

interface SocialRequestRecord {
    id: string;
    fromUserId: string;
    toUserId: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
}

interface SocialShareRecord {
    id: string;
    type: 'habit' | 'goal';
    itemId: string;
    ownerId: string;
    sharedWithId: string;
    status: ShareStatus;
    createdAt: string;
    snapshot: Partial<Habit> & { isGoal?: boolean };
    localCopyId?: string;
}

interface SocialActivityRecord {
    id: string;
    userId: string;
    username: string;
    type: string;
    message: string;
    createdAt: string;
    reactions: Record<string, number>;
}

interface SocialState {
    seedVersion: number;
    users: SocialUserRecord[];
    friendIds: string[];
    requests: SocialRequestRecord[];
    activities: SocialActivityRecord[];
    shares: SocialShareRecord[];
}

const SOCIAL_STATE_KEY = 'habyss_social_state_v3';
const PROFILE_NICKNAME_KEY = 'profile_nickname';
const PROFILE_AVATAR_KEY = 'profile_avatar';
const SEED_VERSION = 3;

const SEED_USERS: SocialUserRecord[] = [
    {
        id: 'crew_aurora_9c1',
        username: 'aurora',
        email: 'aurora@habyss.local',
        currentStreak: 18,
        bestStreak: 32,
        completedToday: 4,
        totalToday: 5,
        weeklyActivity: [80, 100, 80, 60, 100, 100, 80],
        totalHabits: 5,
        totalGoals: 2,
    },
    {
        id: 'crew_milo_3e8',
        username: 'milo',
        email: 'milo@habyss.local',
        currentStreak: 11,
        bestStreak: 21,
        completedToday: 3,
        totalToday: 4,
        weeklyActivity: [75, 50, 75, 100, 75, 75, 50],
        totalHabits: 4,
        totalGoals: 2,
    },
    {
        id: 'crew_nova_22f',
        username: 'nova',
        email: 'nova@habyss.local',
        currentStreak: 26,
        bestStreak: 41,
        completedToday: 5,
        totalToday: 6,
        weeklyActivity: [83, 83, 100, 83, 66, 83, 100],
        totalHabits: 6,
        totalGoals: 3,
    },
    {
        id: 'crew_rhea_71a',
        username: 'rhea',
        email: 'rhea@habyss.local',
        currentStreak: 7,
        bestStreak: 15,
        completedToday: 2,
        totalToday: 4,
        weeklyActivity: [50, 50, 75, 25, 75, 50, 50],
        totalHabits: 4,
        totalGoals: 1,
    },
    {
        id: 'crew_sage_0bf',
        username: 'sage',
        email: 'sage@habyss.local',
        currentStreak: 31,
        bestStreak: 48,
        completedToday: 6,
        totalToday: 6,
        weeklyActivity: [100, 83, 100, 83, 100, 100, 83],
        totalHabits: 6,
        totalGoals: 3,
    },
    {
        id: 'crew_iris_8bd',
        username: 'iris',
        email: 'iris@habyss.local',
        currentStreak: 14,
        bestStreak: 19,
        completedToday: 4,
        totalToday: 5,
        weeklyActivity: [80, 60, 80, 80, 100, 80, 60],
        totalHabits: 5,
        totalGoals: 2,
    },
];

function generateId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sortByRecent<T extends { createdAt: string }>(items: T[]) {
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function normalizeTaskDays(taskDays?: string[]) {
    if (!taskDays || taskDays.length === 0) {
        return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    }

    return taskDays.map((day) => day.slice(0, 3).toLowerCase());
}

function cloneShareableHabit(habit: Habit | (Partial<Habit> & { isGoal?: boolean })) {
    return {
        name: habit.name || 'Untitled',
        description: habit.description,
        icon: habit.icon,
        category: habit.category || 'misc',
        taskDays: normalizeTaskDays(habit.taskDays),
        reminders: habit.reminders || [],
        type: habit.type || 'build',
        color: habit.color || '#6B46C1',
        goalPeriod: habit.goalPeriod || 'daily',
        goalValue: habit.goalValue || 1,
        unit: habit.unit || 'count',
        chartType: habit.chartType || 'bar',
        startDate: habit.startDate || new Date().toISOString().split('T')[0],
        endDate: habit.endDate,
        durationMinutes: habit.durationMinutes,
        startTime: habit.startTime,
        endTime: habit.endTime,
        isGoal: !!habit.isGoal,
        targetDate: habit.targetDate,
        frequency: habit.frequency,
        weekInterval: habit.weekInterval,
        graphStyle: habit.graphStyle,
        timeOfDay: habit.timeOfDay,
        trackingMethod: habit.trackingMethod || 'boolean',
        reminderOffset: habit.reminderOffset,
        ringtone: habit.ringtone || 'default',
        locationReminders: habit.locationReminders || [],
    };
}

async function getProfile() {
    const [userId, nickname, avatarUrl] = await Promise.all([
        getLocalUserId(),
        AsyncStorage.getItem(PROFILE_NICKNAME_KEY),
        AsyncStorage.getItem(PROFILE_AVATAR_KEY),
    ]);

    return {
        userId,
        username: nickname || 'You',
        avatarUrl: avatarUrl || undefined,
    };
}

async function getCurrentUserSnapshot(): Promise<Friend> {
    const profile = await getProfile();
    const [habits, goals, streakData, history, completions] = await Promise.all([
        getHabits(),
        getGoals(),
        getStreakData(),
        getLastNDaysCompletions(7),
        getCompletions(),
    ]);

    const activeHabits = habits.filter((habit) => !habit.isGoal && !habit.isArchived);
    const totalToday = activeHabits.length;
    const completedToday = activeHabits.filter((habit) => completions[habit.id]).length;
    const todayCompletion = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
    const weeklyActivity = history.map((entry) => {
        if (totalToday === 0) return 0;
        const completedIds = entry.completedIds.filter((id) => activeHabits.some((habit) => habit.id === id));
        return Math.round((completedIds.length / totalToday) * 100);
    });

    return {
        id: profile.userId,
        userId: profile.userId,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        currentStreak: streakData.currentStreak,
        bestStreak: streakData.bestStreak,
        streak: streakData.currentStreak,
        todayCompleted: completedToday,
        todayTotal: totalToday,
        todayCompletion,
        weeklyActivity,
        isCurrentUser: true,
    };
}

function mapSeedUserToFriend(user: SocialUserRecord): Friend {
    const todayCompletion = user.totalToday > 0 ? Math.round((user.completedToday / user.totalToday) * 100) : 0;

    return {
        id: user.id,
        userId: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        currentStreak: user.currentStreak,
        bestStreak: user.bestStreak,
        streak: user.currentStreak,
        todayCompleted: user.completedToday,
        todayTotal: user.totalToday,
        todayCompletion,
        weeklyActivity: user.weeklyActivity,
    };
}

function getScoreForPeriod(friend: Friend, period: string) {
    const weeklyAverage = friend.weeklyActivity && friend.weeklyActivity.length > 0
        ? Math.round(friend.weeklyActivity.reduce((sum, value) => sum + value, 0) / friend.weeklyActivity.length)
        : 0;

    switch (period) {
        case 'month':
            return (friend.bestStreak || 0) * 3 + weeklyAverage * 2 + (friend.todayCompletion || 0);
        case 'year':
            return (friend.bestStreak || 0) * 4 + weeklyAverage;
        case 'all':
            return (friend.bestStreak || 0) * 5 + (friend.currentStreak || 0) * 2 + weeklyAverage;
        case 'week':
        default:
            return (friend.currentStreak || 0) * 4 + weeklyAverage * 2 + (friend.todayCompletion || 0);
    }
}

async function buildInitialState(currentUserId: string): Promise<SocialState> {
    const acceptedFriends = [SEED_USERS[0].id, SEED_USERS[2].id];
    const requests: SocialRequestRecord[] = [
        {
            id: 'seed_req_rhea',
            fromUserId: SEED_USERS[3].id,
            toUserId: currentUserId,
            status: 'pending',
            createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        },
    ];
    const activities: SocialActivityRecord[] = [
        {
            id: 'seed_act_nova_1',
            userId: SEED_USERS[2].id,
            username: SEED_USERS[2].username,
            type: 'competition',
            message: 'Nova just closed every habit on today’s stack.',
            createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
            reactions: { fire: 2, clap: 1 },
        },
        {
            id: 'seed_act_aurora_1',
            userId: SEED_USERS[0].id,
            username: SEED_USERS[0].username,
            type: 'streak',
            message: 'Aurora extended a streak to 18 days.',
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            reactions: { muscle: 2, heart: 1 },
        },
    ];

    return {
        seedVersion: SEED_VERSION,
        users: SEED_USERS,
        friendIds: acceptedFriends,
        requests,
        activities,
        shares: [],
    };
}

async function readState(): Promise<SocialState> {
    const currentUserId = await getLocalUserId();
    const raw = await AsyncStorage.getItem(SOCIAL_STATE_KEY);

    if (!raw) {
        const initial = await buildInitialState(currentUserId);
        await AsyncStorage.setItem(SOCIAL_STATE_KEY, JSON.stringify(initial));
        return initial;
    }

    try {
        const parsed = JSON.parse(raw) as SocialState;
        if (!parsed || parsed.seedVersion !== SEED_VERSION || !Array.isArray(parsed.users)) {
            const reset = await buildInitialState(currentUserId);
            await AsyncStorage.setItem(SOCIAL_STATE_KEY, JSON.stringify(reset));
            return reset;
        }

        return {
            ...parsed,
            activities: parsed.activities || [],
            friendIds: parsed.friendIds || [],
            requests: parsed.requests || [],
            shares: parsed.shares || [],
        };
    } catch {
        const reset = await buildInitialState(currentUserId);
        await AsyncStorage.setItem(SOCIAL_STATE_KEY, JSON.stringify(reset));
        return reset;
    }
}

async function writeState(state: SocialState) {
    await AsyncStorage.setItem(SOCIAL_STATE_KEY, JSON.stringify(state));
    DeviceEventEmitter.emit('social_state_updated');
}

function findSeedUser(state: SocialState, userId: string) {
    return state.users.find((user) => user.id === userId);
}

async function addActivity(state: SocialState, activity: Omit<SocialActivityRecord, 'id' | 'createdAt' | 'reactions'> & Partial<Pick<SocialActivityRecord, 'reactions'>>) {
    state.activities = sortByRecent([
        {
            id: generateId('activity'),
            createdAt: new Date().toISOString(),
            reactions: activity.reactions || {},
            ...activity,
        },
        ...state.activities,
    ]).slice(0, 40);
}

async function getShareParticipants(state: SocialState, itemId: string, itemType: 'habit' | 'goal') {
    const currentUser = await getCurrentUserSnapshot();
    const relevantShares = state.shares.filter(
        (share) => share.type === itemType && share.itemId === itemId && share.status === 'accepted'
    );
    const ownerIsCurrentUser = relevantShares.some((share) => share.ownerId === currentUser.id);

    const friendIds = ownerIsCurrentUser
        ? relevantShares.map((share) => share.sharedWithId)
        : relevantShares.map((share) => share.ownerId);

    const participants = await Promise.all(
        friendIds.map(async (friendId) => {
            const user = findSeedUser(state, friendId);
            if (!user) return null;
            return {
                userId: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl,
                completedToday: user.completedToday >= Math.max(1, Math.floor(user.totalToday / 2)),
                isOwner: !ownerIsCurrentUser,
            };
        })
    );

    return [
        {
            userId: currentUser.id,
            username: currentUser.username,
            avatarUrl: currentUser.avatarUrl,
            completedToday: (currentUser.todayCompleted || 0) > 0,
            isOwner: ownerIsCurrentUser,
        },
        ...participants.filter(Boolean),
    ];
}

export class FriendsService {
    static async getCurrentUser(): Promise<Friend | null> {
        return await getCurrentUserSnapshot();
    }

    static async getFriends(): Promise<Friend[]> {
        const state = await readState();
        return state.friendIds
            .map((friendId) => findSeedUser(state, friendId))
            .filter(Boolean)
            .map((friend) => mapSeedUserToFriend(friend!))
            .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0));
    }

    static async getFriendsWithProgress(): Promise<Friend[]> {
        return await this.getFriends();
    }

    static async getFriendRequests(): Promise<FriendRequest[]> {
        const currentUserId = await getLocalUserId();
        const state = await readState();

        return sortByRecent(
            state.requests
                .filter((request) => request.toUserId === currentUserId && request.status === 'pending')
                .map((request) => {
                    const sender = findSeedUser(state, request.fromUserId);
                    return {
                        id: request.id,
                        fromUserId: request.fromUserId,
                        fromUsername: sender?.username || 'Friend',
                        fromAvatarUrl: sender?.avatarUrl,
                        status: request.status,
                        createdAt: request.createdAt,
                    };
                })
        );
    }

    static async sendFriendRequest(userId: string): Promise<boolean> {
        const currentUser = await getCurrentUserSnapshot();
        const state = await readState();

        if (userId === currentUser.id || state.friendIds.includes(userId)) {
            return false;
        }

        const incomingRequest = state.requests.find(
            (request) => request.fromUserId === userId && request.toUserId === currentUser.id && request.status === 'pending'
        );
        if (incomingRequest) {
            return await this.acceptFriendRequest(incomingRequest.id);
        }

        const existingOutgoing = state.requests.find(
            (request) => request.fromUserId === currentUser.id && request.toUserId === userId && request.status === 'pending'
        );
        if (existingOutgoing) {
            return false;
        }

        state.requests.push({
            id: generateId('request'),
            fromUserId: currentUser.id,
            toUserId: userId,
            status: 'accepted',
            createdAt: new Date().toISOString(),
        });
        state.friendIds = Array.from(new Set([...state.friendIds, userId]));

        const target = findSeedUser(state, userId);
        await addActivity(state, {
            userId: currentUser.id,
            username: currentUser.username,
            type: 'friendship',
            message: `${currentUser.username} connected with ${target?.username || 'a new friend'}.`,
        });

        await writeState(state);
        return true;
    }

    static async acceptFriendRequest(requestId: string): Promise<boolean> {
        const currentUserId = await getLocalUserId();
        const state = await readState();
        const request = state.requests.find((item) => item.id === requestId && item.toUserId === currentUserId);
        if (!request) return false;

        request.status = 'accepted';
        state.friendIds = Array.from(new Set([...state.friendIds, request.fromUserId]));

        const sender = findSeedUser(state, request.fromUserId);
        await addActivity(state, {
            userId: request.fromUserId,
            username: sender?.username || 'Friend',
            type: 'friendship',
            message: `${sender?.username || 'Friend'} joined your crew.`,
        });

        await writeState(state);
        return true;
    }

    static async declineFriendRequest(requestId: string): Promise<boolean> {
        const currentUserId = await getLocalUserId();
        const state = await readState();
        const request = state.requests.find((item) => item.id === requestId && item.toUserId === currentUserId);
        if (!request) return false;

        request.status = 'rejected';
        await writeState(state);
        return true;
    }

    static async rejectFriendRequest(requestId: string): Promise<boolean> {
        return await this.declineFriendRequest(requestId);
    }

    static async removeFriend(friendId: string): Promise<boolean> {
        const state = await readState();
        if (!state.friendIds.includes(friendId)) return false;

        state.friendIds = state.friendIds.filter((id) => id !== friendId);
        state.shares = state.shares.filter((share) => share.sharedWithId !== friendId && share.ownerId !== friendId);
        await writeState(state);
        return true;
    }

    static async repairFriendshipsFromAcceptedRequests(): Promise<void> {
        const currentUserId = await getLocalUserId();
        const state = await readState();
        const acceptedRequestFriendIds = state.requests
            .filter(
                (request) =>
                    request.status === 'accepted' &&
                    (request.fromUserId === currentUserId || request.toUserId === currentUserId)
            )
            .map((request) => (request.fromUserId === currentUserId ? request.toUserId : request.fromUserId));

        state.friendIds = Array.from(new Set([...state.friendIds, ...acceptedRequestFriendIds]));
        await writeState(state);
    }

    static async getFriendActivity(): Promise<FriendActivity[]> {
        return await this.getFriendsFeed();
    }

    static async getFriendsFeed(): Promise<FriendActivity[]> {
        const state = await readState();
        const currentUserId = await getLocalUserId();
        return sortByRecent(
            state.activities.filter((activity) => activity.userId !== currentUserId)
        ).map((activity) => ({
            id: activity.id,
            userId: activity.userId,
            username: activity.username,
            type: activity.type,
            message: activity.message,
            createdAt: activity.createdAt,
            reactions: activity.reactions,
        }));
    }

    static async searchUsers(query: string): Promise<Friend[]> {
        if (!query.trim()) return [];

        const currentUserId = await getLocalUserId();
        const state = await readState();
        const normalized = query.trim().toLowerCase();

        return state.users
            .filter((user) => user.id !== currentUserId)
            .filter((user) => {
                const matchesCode = user.id.toLowerCase().includes(normalized);
                const matchesName = user.username.toLowerCase().includes(normalized);
                const matchesEmail = user.email.toLowerCase().includes(normalized);
                return matchesCode || matchesName || matchesEmail;
            })
            .map((user) => mapSeedUserToFriend(user))
            .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0));
    }

    static async addReaction(activityId: string, reaction: ReactionType): Promise<boolean> {
        return await this.sendReaction(activityId, reaction);
    }

    static async sendReaction(activityId: string, reaction: ReactionType): Promise<boolean> {
        const state = await readState();
        const activity = state.activities.find((item) => item.id === activityId);
        if (!activity) return false;

        activity.reactions[reaction] = (activity.reactions[reaction] || 0) + 1;
        await writeState(state);
        return true;
    }

    static async removeReaction(activityId: string, reaction: ReactionType): Promise<boolean> {
        const state = await readState();
        const activity = state.activities.find((item) => item.id === activityId);
        if (!activity || !activity.reactions[reaction]) return false;

        activity.reactions[reaction] = Math.max(0, activity.reactions[reaction] - 1);
        if (activity.reactions[reaction] === 0) {
            delete activity.reactions[reaction];
        }
        await writeState(state);
        return true;
    }

    static async getLeaderboard(period = 'week'): Promise<{ rank: number; friend: Friend }[]> {
        const currentUser = await getCurrentUserSnapshot();
        const friends = await this.getFriends();
        return [currentUser, ...friends]
            .sort((a, b) => getScoreForPeriod(b, period) - getScoreForPeriod(a, period))
            .map((friend, index) => ({
                rank: index + 1,
                friend,
            }));
    }

    static async getFriendProfile(friendId: string): Promise<Friend | null> {
        const currentUser = await getCurrentUserSnapshot();
        if (friendId === currentUser.id) return currentUser;

        const state = await readState();
        const user = findSeedUser(state, friendId);
        return user ? mapSeedUserToFriend(user) : null;
    }

    static async getFriendDetailedStats(friendId: string): Promise<any | null> {
        const currentUser = await getCurrentUserSnapshot();
        if (friendId === currentUser.id) {
            const goals = await getGoals();
            return {
                totalHabits: currentUser.todayTotal || 0,
                completedToday: currentUser.todayCompleted || 0,
                totalGoals: goals.length,
                weeklyActivity: (currentUser.weeklyActivity || []).map((value) => value >= 50),
                longestStreak: currentUser.bestStreak || 0,
            };
        }

        const state = await readState();
        const user = findSeedUser(state, friendId);
        if (!user) return null;

        return {
            totalHabits: user.totalHabits,
            completedToday: user.completedToday,
            totalGoals: user.totalGoals,
            weeklyActivity: user.weeklyActivity.map((value) => value >= 50),
            longestStreak: user.bestStreak,
        };
    }

    static async nudgeFriend(friendId: string, username?: string): Promise<boolean> {
        const currentUser = await getCurrentUserSnapshot();
        const state = await readState();
        const target = findSeedUser(state, friendId);
        if (!target) return false;

        await addActivity(state, {
            userId: currentUser.id,
            username: currentUser.username,
            type: 'nudge',
            message: `${currentUser.username} nudged ${username || target.username} to stay on pace.`,
        });
        await writeState(state);
        return true;
    }

    static async shareHabitWithFriend(habitId: string, friendId: string): Promise<boolean> {
        const currentUser = await getCurrentUserSnapshot();
        const state = await readState();
        const habit = (await getHabits()).find((item) => item.id === habitId && !item.isGoal);
        if (!habit) return false;

        const existing = state.shares.find(
            (share) => share.type === 'habit' && share.itemId === habitId && share.ownerId === currentUser.id && share.sharedWithId === friendId
        );
        if (existing) {
            existing.status = 'accepted';
            await writeState(state);
            return true;
        }

        state.shares.push({
            id: generateId('share_habit'),
            type: 'habit',
            itemId: habitId,
            ownerId: currentUser.id,
            sharedWithId: friendId,
            status: 'accepted',
            createdAt: new Date().toISOString(),
            snapshot: cloneShareableHabit(habit),
        });

        const friend = findSeedUser(state, friendId);
        await addActivity(state, {
            userId: currentUser.id,
            username: currentUser.username,
            type: 'shared_habit',
            message: `${currentUser.username} shared "${habit.name}" with ${friend?.username || 'a friend'}.`,
        });

        await writeState(state);
        return true;
    }

    static async unshareHabit(habitId: string, friendId: string): Promise<boolean> {
        const currentUserId = await getLocalUserId();
        const state = await readState();
        const nextShares = state.shares.filter(
            (share) =>
                !(
                    share.type === 'habit' &&
                    share.itemId === habitId &&
                    share.ownerId === currentUserId &&
                    share.sharedWithId === friendId
                )
        );

        if (nextShares.length === state.shares.length) return false;
        state.shares = nextShares;
        await writeState(state);
        return true;
    }

    static async getHabitSharedWith(habitId: string): Promise<Friend[]> {
        const currentUserId = await getLocalUserId();
        const state = await readState();

        return state.shares
            .filter(
                (share) =>
                    share.type === 'habit' &&
                    share.itemId === habitId &&
                    share.ownerId === currentUserId &&
                    share.status === 'accepted'
            )
            .map((share) => findSeedUser(state, share.sharedWithId))
            .filter(Boolean)
            .map((user) => mapSeedUserToFriend(user!));
    }

    static async getGoalSharedWith(goalId: string): Promise<Friend[]> {
        const currentUserId = await getLocalUserId();
        const state = await readState();

        return state.shares
            .filter(
                (share) =>
                    share.type === 'goal' &&
                    share.itemId === goalId &&
                    share.ownerId === currentUserId &&
                    share.status === 'accepted'
            )
            .map((share) => findSeedUser(state, share.sharedWithId))
            .filter(Boolean)
            .map((user) => mapSeedUserToFriend(user!));
    }

    static async batchShareGoal(goalId: string, friendIds: string[]): Promise<boolean> {
        const currentUser = await getCurrentUserSnapshot();
        const state = await readState();
        const goal = (await getHabits()).find((item) => item.id === goalId && item.isGoal);
        if (!goal) return false;

        friendIds.forEach((friendId) => {
            const existing = state.shares.find(
                (share) => share.type === 'goal' && share.itemId === goalId && share.ownerId === currentUser.id && share.sharedWithId === friendId
            );

            if (existing) {
                existing.status = 'accepted';
                return;
            }

            state.shares.push({
                id: generateId('share_goal'),
                type: 'goal',
                itemId: goalId,
                ownerId: currentUser.id,
                sharedWithId: friendId,
                status: 'accepted',
                createdAt: new Date().toISOString(),
                snapshot: cloneShareableHabit(goal),
            });
        });

        if (friendIds.length > 0) {
            await addActivity(state, {
                userId: currentUser.id,
                username: currentUser.username,
                type: 'shared_goal',
                message: `${currentUser.username} launched a shared goal challenge.`,
            });
        }

        await writeState(state);
        return true;
    }

    static async batchUnshareGoal(goalId: string, friendIds: string[]): Promise<boolean> {
        const currentUserId = await getLocalUserId();
        const state = await readState();
        state.shares = state.shares.filter(
            (share) =>
                !(
                    share.type === 'goal' &&
                    share.itemId === goalId &&
                    share.ownerId === currentUserId &&
                    friendIds.includes(share.sharedWithId)
                )
        );
        await writeState(state);
        return true;
    }

    static async getHabitsSharedWithMe(): Promise<any[]> {
        const currentUserId = await getLocalUserId();
        const state = await readState();

        return state.shares
            .filter(
                (share) =>
                    share.type === 'habit' &&
                    share.sharedWithId === currentUserId &&
                    share.status === 'accepted' &&
                    !share.localCopyId
            )
            .map((share) => ({
                habit: {
                    id: share.itemId,
                    ...share.snapshot,
                },
                owner: mapSeedUserToFriend(findSeedUser(state, share.ownerId)!),
            }));
    }

    static async getGoalsSharedWithMe(): Promise<any[]> {
        const currentUserId = await getLocalUserId();
        const state = await readState();
        const habits = await getHabits();

        return state.shares
            .filter(
                (share) =>
                    share.type === 'goal' &&
                    share.sharedWithId === currentUserId &&
                    share.status === 'accepted'
            )
            .map((share) => {
                const localGoal = share.localCopyId ? habits.find((habit) => habit.id === share.localCopyId) : null;
                return {
                    goal: {
                        id: localGoal?.id || share.itemId,
                        ...share.snapshot,
                        ...(localGoal || {}),
                    },
                    owner: mapSeedUserToFriend(findSeedUser(state, share.ownerId)!),
                };
            });
    }

    static async getSharedItemParticipants(itemId: string, itemType: string = 'habit'): Promise<any[]> {
        const state = await readState();
        return await getShareParticipants(state, itemId, itemType as 'habit' | 'goal');
    }

    static async acceptShareRequest(type: string, itemId: string, ownerId: string): Promise<boolean> {
        const currentUserId = await getLocalUserId();
        const state = await readState();
        const share = state.shares.find(
            (item) =>
                item.type === type &&
                item.itemId === itemId &&
                item.ownerId === ownerId &&
                item.sharedWithId === currentUserId
        );

        if (!share) return false;

        share.status = 'accepted';
        if (!share.localCopyId) {
            const created = await addHabit({
                ...cloneShareableHabit(share.snapshot),
                isGoal: share.type === 'goal',
            });
            if (created) {
                share.localCopyId = created.id;
            }
        }

        await writeState(state);
        return true;
    }

    static async declineShareRequest(type: string, itemId: string, ownerId: string): Promise<boolean> {
        const currentUserId = await getLocalUserId();
        const state = await readState();
        const share = state.shares.find(
            (item) =>
                item.type === type &&
                item.itemId === itemId &&
                item.ownerId === ownerId &&
                item.sharedWithId === currentUserId
        );
        if (!share) return false;

        share.status = 'declined';
        await writeState(state);
        return true;
    }
}
