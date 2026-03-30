/**
 * Friends Service — Local Stub
 * Full implementation moved to _premium/friendsService.ts
 * This stub prevents import errors in free tier.
 */

export type ReactionType = 'fire' | 'clap' | 'heart' | 'star' | 'muscle';

export interface Friend {
    id: string;
    userId: string;
    username: string;
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

export class FriendsService {
    // === Core Friends ===
    static async getFriends(): Promise<Friend[]> {
        return [];
    }

    static async getFriendsWithProgress(): Promise<Friend[]> {
        return [];
    }

    static async getCurrentUser(): Promise<Friend | null> {
        return null;
    }

    static async getFriendRequests(): Promise<FriendRequest[]> {
        return [];
    }

    static async sendFriendRequest(_userId: string): Promise<boolean> {
        console.log('[Friends] Social features require premium');
        return false;
    }

    static async acceptFriendRequest(_requestId: string): Promise<boolean> {
        return false;
    }

    static async declineFriendRequest(_requestId: string): Promise<boolean> {
        return false;
    }

    static async rejectFriendRequest(_requestId: string): Promise<boolean> {
        return false;
    }

    static async removeFriend(_friendId: string): Promise<boolean> {
        return false;
    }

    static async repairFriendshipsFromAcceptedRequests(): Promise<void> {
        // No-op
    }

    // === Activity Feed ===
    static async getFriendActivity(): Promise<FriendActivity[]> {
        return [];
    }

    static async getFriendsFeed(): Promise<FriendActivity[]> {
        return [];
    }

    // === Search & Discovery ===
    static async searchUsers(_query: string): Promise<Friend[]> {
        return [];
    }

    // === Reactions ===
    static async addReaction(_activityId: string, _reaction: ReactionType): Promise<boolean> {
        return false;
    }

    static async sendReaction(_activityId: string, _reaction: ReactionType): Promise<boolean> {
        return false;
    }

    static async removeReaction(_activityId: string, _reaction: ReactionType): Promise<boolean> {
        return false;
    }

    // === Leaderboard & Stats ===
    static async getLeaderboard(_period?: string): Promise<{ rank: number; friend: Friend }[]> {
        return [];
    }

    static async getFriendProfile(_friendId: string): Promise<Friend | null> {
        return null;
    }

    static async getFriendDetailedStats(_friendId: string): Promise<any | null> {
        return null;
    }

    // === Social Interactions ===
    static async nudgeFriend(_friendId: string, _username?: string): Promise<boolean> {
        return false;
    }

    // === Sharing ===
    static async shareHabitWithFriend(_habitId: string, _friendId: string): Promise<boolean> {
        return false;
    }

    static async unshareHabit(_habitId: string, _friendId: string): Promise<boolean> {
        return false;
    }

    static async getHabitSharedWith(_habitId: string): Promise<Friend[]> {
        return [];
    }

    static async getGoalSharedWith(_goalId: string): Promise<Friend[]> {
        return [];
    }

    static async batchShareGoal(_goalId: string, _friendIds: string[]): Promise<boolean> {
        return false;
    }

    static async batchUnshareGoal(_goalId: string, _friendIds: string[]): Promise<boolean> {
        return false;
    }

    static async getHabitsSharedWithMe(): Promise<any[]> {
        return [];
    }

    static async getGoalsSharedWithMe(): Promise<any[]> {
        return [];
    }

    static async getSharedItemParticipants(_itemId: string, _itemType?: string): Promise<any[]> {
        return [];
    }

    static async acceptShareRequest(_requestId: string, _type?: string, _shareId?: string): Promise<boolean> {
        return false;
    }

    static async declineShareRequest(_requestId: string, _type?: string, _shareId?: string): Promise<boolean> {
        return false;
    }
}
