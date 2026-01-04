import { supabase } from '@/lib/supabase';

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

export interface FriendActivity {
    id: string;
    friendId: string;
    friendUsername: string;
    friendAvatarUrl?: string;
    habitName: string;
    habitIcon: string;
    completedAt: string;
    reactions: { type: string; count: number }[];
}

export type ReactionType = '🔥' | '👏' | '💪';

// Helper to check if table doesn't exist
const isTableMissing = (error: any): boolean => {
    return error?.code === 'PGRST205' ||
        error?.code === '42P01' ||
        error?.message?.includes('relation') ||
        error?.message?.includes('does not exist');
};

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
     */
    async searchUsers(query: string): Promise<Friend[]> {
        if (!query || query.length < 1) return []; // Changed from 3 to 1 char minimum

        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return [];

            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, email, avatar_url')
                .or(`email.ilike.%${query}%,username.ilike.%${query}%`)
                .neq('id', currentUser.id)
                .limit(20); // Increased from 10 to 20

            if (error) {
                if (isTableMissing(error)) {
                    console.log('Profiles table not set up yet');
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
     * Returns: 'sent' | 'already_friends' | 'already_requested' | 'pending_from_them' | 'error'
     */
    async sendFriendRequest(toUserId: string): Promise<boolean> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return false;

            // Check if already friends
            const { data: existingFriendship } = await supabase
                .from('friendships')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('friend_id', toUserId)
                .single();

            if (existingFriendship) {
                console.log('Already friends with this user');
                return false; // Already friends
            }

            // Check if there's a pending request from them to us
            const { data: incomingRequest } = await supabase
                .from('friend_requests')
                .select('id')
                .eq('from_user_id', toUserId)
                .eq('to_user_id', currentUser.id)
                .eq('status', 'pending')
                .single();

            if (incomingRequest) {
                // Auto-accept their request instead
                console.log('They already sent us a request - auto-accepting');
                return await this.acceptFriendRequest(incomingRequest.id);
            }

            // Check if we already sent them a request
            const { data: existingRequest } = await supabase
                .from('friend_requests')
                .select('id, status')
                .eq('from_user_id', currentUser.id)
                .eq('to_user_id', toUserId)
                .single();

            if (existingRequest) {
                console.log('Already sent a request to this user, status:', existingRequest.status);
                return false; // Already sent
            }

            // Send new request
            const { error } = await supabase
                .from('friend_requests')
                .insert({
                    from_user_id: currentUser.id,
                    to_user_id: toUserId,
                    status: 'pending'
                });

            if (error) {
                if (isTableMissing(error)) return false;
                // Handle duplicate key error gracefully
                if (error.code === '23505') {
                    console.log('Request already exists');
                    return false;
                }
                console.error('Error sending friend request:', error);
                return false;
            }
            return true;
        } catch (e) {
            console.error('Exception in sendFriendRequest:', e);
            return false;
        }
    },

    /**
     * Accept a friend request
     */
    async acceptFriendRequest(requestId: string): Promise<boolean> {
        try {
            const { data: request, error: fetchError } = await supabase
                .from('friend_requests')
                .select('from_user_id, to_user_id')
                .eq('id', requestId)
                .single();

            if (fetchError || !request) {
                console.error('Error fetching friend request:', fetchError);
                return false;
            }

            // Update request status
            const { error: updateError } = await supabase
                .from('friend_requests')
                .update({ status: 'accepted' })
                .eq('id', requestId);

            if (updateError) {
                console.error('Error updating friend request status:', updateError);
            }

            // Create both friendship directions
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return false;

            const { error: insertError } = await supabase.from('friendships').insert([
                { user_id: currentUser.id, friend_id: request.from_user_id },
                { user_id: request.from_user_id, friend_id: currentUser.id }
            ]);

            if (insertError) {
                console.error('Error creating friendships:', insertError);
                return false;
            }

            console.log('Friend request accepted successfully!');
            return true;
        } catch (e) {
            console.error('Exception in acceptFriendRequest:', e);
            return false;
        }
    },

    /**
     * Decline a friend request
     */
    async declineFriendRequest(requestId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('friend_requests')
                .update({ status: 'declined' })
                .eq('id', requestId);

            return !error;
        } catch (e) {
            return false;
        }
    },

    /**
     * Get list of friends with their stats
     */
    async getFriends(): Promise<Friend[]> {
        try {
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
                if (isTableMissing(error)) {
                    // console.log('Friendships table not set up yet');
                    return [];
                }
                console.error('Error fetching friends:', error);
                return [];
            }

            const friends: Friend[] = [];
            const today = new Date().toISOString().split('T')[0];

            for (const row of data || []) {
                const profile = row.profiles as any;
                if (!profile) continue;

                friends.push({
                    id: profile.id,
                    username: profile.username || profile.email?.split('@')[0] || 'User',
                    email: profile.email || '',
                    avatarUrl: profile.avatar_url,
                    currentStreak: 0,
                    todayCompletion: 0,
                });
            }

            return friends;
        } catch (e) {
            console.log('Friends list not available');
            return [];
        }
    },

    /**
     * Get pending friend requests
     */
    async getFriendRequests(): Promise<FriendRequest[]> {
        try {
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
                if (isTableMissing(error)) return [];
                console.error('Error fetching friend requests:', error);
                return [];
            }

            return (data || []).map(r => {
                const profile = r.profiles as any;
                return {
                    id: r.id,
                    fromUserId: r.from_user_id,
                    fromUsername: profile?.username || 'User',
                    fromAvatarUrl: profile?.avatar_url,
                    createdAt: r.created_at,
                };
            });
        } catch (e) {
            return [];
        }
    },

    /**
     * Nudge a friend (send push notification)
     */
    async nudgeFriend(friendId: string, friendName: string): Promise<boolean> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return false;

            // Get friend's push token
            const { data: profile } = await supabase
                .from('profiles')
                .select('push_token')
                .eq('id', friendId)
                .single();

            if (!profile?.push_token) {
                console.log('Friend has no push token');
                return false;
            }

            // Send notification (simplified)
            console.log(`Nudging ${friendName} with token:`, profile.push_token);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Get leaderboard
     */
    async getLeaderboard(): Promise<{ rank: number; friend: Friend }[]> {
        try {
            const friends = await this.getFriends();
            const currentUser = await this.getCurrentUser();

            if (!currentUser) return [];

            // Add current user to list
            const allUsers = [
                ...friends,
                {
                    id: currentUser.id,
                    username: 'You',
                    email: currentUser.email || '',
                    currentStreak: 0,
                    todayCompletion: 0,
                }
            ];

            // Sort by streak then completion
            allUsers.sort((a, b) => {
                if (b.currentStreak !== a.currentStreak) {
                    return b.currentStreak - a.currentStreak;
                }
                return b.todayCompletion - a.todayCompletion;
            });

            return allUsers.map((friend, index) => ({
                rank: index + 1,
                friend,
            }));
        } catch (e) {
            return [];
        }
    },

    /**
     * Share a habit with a friend
     */
    async shareHabitWithFriend(habitId: string, friendId: string): Promise<boolean> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return false;

            const { error } = await supabase
                .from('shared_habits')
                .insert({
                    habit_id: habitId,
                    owner_id: currentUser.id,
                    shared_with_id: friendId,
                });

            if (error) {
                if (isTableMissing(error)) return false;
                console.error('Error sharing habit:', error);
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Unshare a habit
     */
    async unshareHabit(habitId: string, friendId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('shared_habits')
                .delete()
                .eq('habit_id', habitId)
                .eq('shared_with_id', friendId);

            return !error;
        } catch (e) {
            return false;
        }
    },

    /**
     * Get habits shared with me
     */
    async getHabitsSharedWithMe(): Promise<any[]> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return [];

            const { data, error } = await supabase
                .from('shared_habits')
                .select(`
                    habit_id,
                    owner_id,
                    habits:habit_id (id, name, icon, category),
                    profiles:owner_id (id, username)
                `)
                .eq('shared_with_id', currentUser.id);

            if (error) {
                if (isTableMissing(error)) return [];
                return [];
            }

            return (data || []).map(row => {
                const habit = row.habits as any;
                const owner = row.profiles as any;
                return {
                    habit: {
                        id: habit?.id,
                        name: habit?.name,
                        icon: habit?.icon,
                        category: habit?.category,
                    },
                    owner: {
                        id: owner?.id,
                        username: owner?.username,
                    },
                    todayCompleted: false,
                };
            });
        } catch (e) {
            return [];
        }
    },

    /**
     * Get friends a habit is shared with
     */
    async getHabitSharedWith(habitId: string): Promise<Friend[]> {
        try {
            const { data, error } = await supabase
                .from('shared_habits')
                .select(`
                    shared_with_id,
                    profiles:shared_with_id (id, username, email, avatar_url)
                `)
                .eq('habit_id', habitId);

            if (error) {
                if (isTableMissing(error)) return [];
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
        } catch (e) {
            return [];
        }
    },

    /**
     * Get friends' recent activity (mock for now - returns sample data)
     */
    async getFriendsFeed(): Promise<FriendActivity[]> {
        try {
            const friends = await this.getFriends();
            if (friends.length === 0) return [];

            // Mock activity data based on friends
            // In production, this would query completions table joined with friends
            const mockActivities: FriendActivity[] = friends.slice(0, 5).map((friend, i) => ({
                id: `activity-${friend.id}-${i}`,
                friendId: friend.id,
                friendUsername: friend.username,
                friendAvatarUrl: friend.avatarUrl,
                habitName: ['Morning Run', 'Meditation', 'Read 30min', 'Drink Water', 'Workout'][i % 5],
                habitIcon: ['fitness', 'leaf', 'book', 'water', 'barbell'][i % 5],
                completedAt: new Date(Date.now() - i * 3600000).toISOString(), // Staggered times
                reactions: i % 2 === 0 ? [{ type: '🔥', count: 2 }] : [],
            }));

            return mockActivities;
        } catch (e) {
            return [];
        }
    },

    /**
     * Send a reaction to a friend's activity
     */
    async sendReaction(activityId: string, reaction: ReactionType): Promise<boolean> {
        try {
            // Mock implementation - just log and return success
            // In production, this would insert into a reactions table
            console.log(`Sending reaction ${reaction} to activity ${activityId}`);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Get friends with their real-time progress
     */
    async getFriendsWithProgress(): Promise<Friend[]> {
        const friends = await this.getFriends();

        // Mock progress data - in production, query completions for each friend
        return friends.map((friend, i) => ({
            ...friend,
            todayCompletion: Math.floor(Math.random() * 100), // Random for demo
            currentStreak: Math.floor(Math.random() * 30),
        }));
    },
};
