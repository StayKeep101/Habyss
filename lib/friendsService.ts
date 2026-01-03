import { supabase } from '@/lib/supabase';
import { NotificationService } from './notificationService';

export interface Friend {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
    currentStreak: number;
    todayCompletion: number;
}

export interface FriendRequest {
    id: string;
    fromUserId: string;
    fromUsername: string;
    fromAvatarUrl?: string;
    createdAt: string;
}

export const FriendsService = {
    /**
     * Get current user's profile
     */
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    /**
     * Search users by email or username
     * Falls back gracefully if profiles table doesn't exist
     */
    async searchUsers(query: string): Promise<Friend[]> {
        if (!query || query.length < 3) return [];

        const currentUser = await this.getCurrentUser();
        if (!currentUser) return [];

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, email, avatar_url')
                .or(`email.ilike.%${query}%,username.ilike.%${query}%`)
                .neq('id', currentUser.id)
                .limit(10);

            if (error) {
                // If profiles table doesn't exist, return empty gracefully
                if (error.code === 'PGRST205' || error.message?.includes('profiles')) {
                    console.log('Profiles table not configured yet - friend search unavailable');
                    return [];
                }
                console.error('Error searching users:', error);
                return [];
            }

            return (data || []).map(u => ({
                id: u.id,
                username: u.username || u.email?.split('@')[0] || 'User',
                email: u.email || '',
                avatarUrl: u.avatar_url,
                currentStreak: 0,
                todayCompletion: 0,
            }));
        } catch (e) {
            console.log('Friend search not available');
            return [];
        }
    },

    /**
     * Send a friend request
     */
    async sendFriendRequest(toUserId: string): Promise<boolean> {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) return false;

        const { error } = await supabase
            .from('friend_requests')
            .insert({
                from_user_id: currentUser.id,
                to_user_id: toUserId,
                status: 'pending'
            });

        if (error) {
            console.error('Error sending friend request:', error);
            return false;
        }

        return true;
    },

    /**
     * Accept a friend request
     */
    async acceptFriendRequest(requestId: string): Promise<boolean> {
        const { data: request, error: fetchError } = await supabase
            .from('friend_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !request) return false;

        // Create friendship
        const { error: insertError } = await supabase
            .from('friendships')
            .insert([
                { user_id: request.from_user_id, friend_id: request.to_user_id },
                { user_id: request.to_user_id, friend_id: request.from_user_id }
            ]);

        if (insertError) {
            console.error('Error creating friendship:', insertError);
            return false;
        }

        // Update request status
        await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        return true;
    },

    /**
     * Decline a friend request
     */
    async declineFriendRequest(requestId: string): Promise<boolean> {
        const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'declined' })
            .eq('id', requestId);

        return !error;
    },

    /**
     * Get list of friends with their stats
     */
    async getFriends(): Promise<Friend[]> {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) return [];

        const { data, error } = await supabase
            .from('friendships')
            .select(`
        friend_id,
        profiles:friend_id (id, username, email, avatar_url)
      `)
            .eq('user_id', currentUser.id);

        if (error) {
            console.error('Error fetching friends:', error);
            return [];
        }

        // Get friend stats (streak and today's completion)
        const friends: Friend[] = [];
        for (const row of data || []) {
            const profile = row.profiles as any;
            if (!profile) continue;

            // Get streak (simplified - count consecutive days with completions)
            const { data: completions } = await supabase
                .from('habit_completions')
                .select('date')
                .eq('user_id', profile.id)
                .order('date', { ascending: false })
                .limit(30);

            let streak = 0;
            if (completions && completions.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const dates = completions.map(c => c.date);
                if (dates[0] === today || dates[0] === getYesterday()) {
                    streak = 1;
                    for (let i = 1; i < dates.length; i++) {
                        const prev = new Date(dates[i - 1]);
                        const curr = new Date(dates[i]);
                        const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
                        if (diff === 1) streak++;
                        else break;
                    }
                }
            }

            // Get today's completion
            const today = new Date().toISOString().split('T')[0];
            const { count: todayCount } = await supabase
                .from('habit_completions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id)
                .eq('date', today);

            const { count: totalHabits } = await supabase
                .from('habits')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id)
                .eq('is_archived', false);

            const completion = totalHabits ? Math.round(((todayCount || 0) / totalHabits) * 100) : 0;

            friends.push({
                id: profile.id,
                username: profile.username || profile.email?.split('@')[0] || 'User',
                email: profile.email || '',
                avatarUrl: profile.avatar_url,
                currentStreak: streak,
                todayCompletion: completion,
            });
        }

        return friends;
    },

    /**
     * Get pending friend requests
     */
    async getFriendRequests(): Promise<FriendRequest[]> {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) return [];

        const { data, error } = await supabase
            .from('friend_requests')
            .select(`
        id,
        from_user_id,
        created_at,
        profiles:from_user_id (username, avatar_url)
      `)
            .eq('to_user_id', currentUser.id)
            .eq('status', 'pending');

        if (error) {
            console.error('Error fetching friend requests:', error);
            return [];
        }

        return (data || []).map(r => ({
            id: r.id,
            fromUserId: r.from_user_id,
            fromUsername: (r.profiles as any)?.username || 'User',
            fromAvatarUrl: (r.profiles as any)?.avatar_url,
            createdAt: r.created_at,
        }));
    },

    /**
     * Send a nudge to a friend (push notification)
     */
    async nudgeFriend(friendId: string, friendName: string): Promise<boolean> {
        try {
            // Get friend's push token
            const { data: profile } = await supabase
                .from('profiles')
                .select('push_token')
                .eq('id', friendId)
                .single();

            if (profile?.push_token) {
                // Send push notification via Expo
                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: profile.push_token,
                        title: "You've been nudged! 👋",
                        body: "Your friend is checking in. Time to complete your habits!",
                        sound: 'default',
                    }),
                });
            }
            return true;
        } catch (error) {
            console.error('Error nudging friend:', error);
            return false;
        }
    },

    /**
     * Get weekly leaderboard among friends
     */
    async getLeaderboard(): Promise<{ rank: number; friend: Friend }[]> {
        const friends = await this.getFriends();
        const currentUser = await this.getCurrentUser();

        // Add current user to the list
        if (currentUser) {
            const today = new Date().toISOString().split('T')[0];
            const { count: todayCount } = await supabase
                .from('habit_completions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .eq('date', today);

            const { count: totalHabits } = await supabase
                .from('habits')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .eq('is_archived', false);

            friends.push({
                id: currentUser.id,
                username: 'You',
                email: currentUser.email || '',
                currentStreak: 0, // Would need to calculate
                todayCompletion: totalHabits ? Math.round(((todayCount || 0) / totalHabits) * 100) : 0,
            });
        }

        // Sort by streak then by completion
        friends.sort((a, b) => {
            if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
            return b.todayCompletion - a.todayCompletion;
        });

        return friends.map((friend, index) => ({
            rank: index + 1,
            friend,
        }));
    },

    /**
     * Share a habit with a friend
     */
    async shareHabitWithFriend(habitId: string, friendId: string): Promise<boolean> {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) return false;

        const { error } = await supabase
            .from('shared_habits')
            .upsert({
                habit_id: habitId,
                owner_id: currentUser.id,
                shared_with_id: friendId,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error sharing habit:', error);
            return false;
        }
        return true;
    },

    /**
     * Stop sharing a habit with a friend
     */
    async unshareHabit(habitId: string, friendId: string): Promise<boolean> {
        const { error } = await supabase
            .from('shared_habits')
            .delete()
            .eq('habit_id', habitId)
            .eq('shared_with_id', friendId);

        return !error;
    },

    /**
     * Get habits shared with you by friends
     */
    async getHabitsSharedWithMe(): Promise<{
        habit: { id: string; name: string; icon: string; category: string };
        owner: { id: string; username: string };
        todayCompleted: boolean;
    }[]> {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) return [];

        const { data, error } = await supabase
            .from('shared_habits')
            .select(`
                habit_id,
                habits:habit_id (id, name, icon, category),
                profiles:owner_id (id, username)
            `)
            .eq('shared_with_id', currentUser.id);

        if (error) {
            console.error('Error fetching shared habits:', error);
            return [];
        }

        const today = new Date().toISOString().split('T')[0];
        const results = [];

        for (const row of data || []) {
            const habit = row.habits as any;
            const owner = row.profiles as any;
            if (!habit || !owner) continue;

            // Check if completed today
            const { count } = await supabase
                .from('habit_completions')
                .select('*', { count: 'exact', head: true })
                .eq('habit_id', habit.id)
                .eq('date', today);

            results.push({
                habit: {
                    id: habit.id,
                    name: habit.name,
                    icon: habit.icon || 'star',
                    category: habit.category,
                },
                owner: {
                    id: owner.id,
                    username: owner.username || 'User',
                },
                todayCompleted: (count || 0) > 0,
            });
        }

        return results;
    },

    /**
     * Get friends I've shared a specific habit with
     */
    async getHabitSharedWith(habitId: string): Promise<Friend[]> {
        const { data, error } = await supabase
            .from('shared_habits')
            .select(`
                shared_with_id,
                profiles:shared_with_id (id, username, email, avatar_url)
            `)
            .eq('habit_id', habitId);

        if (error) {
            console.error('Error fetching habit shares:', error);
            return [];
        }

        return (data || []).map(row => {
            const profile = row.profiles as any;
            return {
                id: profile?.id || '',
                username: profile?.username || 'User',
                email: profile?.email || '',
                avatarUrl: profile?.avatar_url,
                currentStreak: 0,
                todayCompletion: 0,
            };
        }).filter(f => f.id);
    },
};

function getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}
