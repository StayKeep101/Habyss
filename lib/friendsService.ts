import { supabase } from '@/lib/supabase';

export interface Friend {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
    currentStreak: number;
    todayCompletion: number;
    bestStreak?: number; // Longest streak ever
    weeklyActivity?: number[]; // 7 days of completion %
    // Profile info for display
    // bio is stored locally, not in DB
    isCurrentUser?: boolean; // Flag to show "(You)" indicator
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
     * REPAIR: Sync accepted friend requests to friendships table
     * Call this to fix "connected but not visible" friends
     */
    async repairFriendshipsFromAcceptedRequests(): Promise<number> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return 0;

            console.log('Repairing friendships for user:', currentUser.id);

            // Get all accepted requests involving current user
            const { data: acceptedRequests } = await supabase
                .from('friend_requests')
                .select('id, from_user_id, to_user_id')
                .eq('status', 'accepted')
                .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`);

            if (!acceptedRequests || acceptedRequests.length === 0) {
                console.log('No accepted requests to repair');
                return 0;
            }

            console.log(`Found ${acceptedRequests.length} accepted requests to repair`);

            let repaired = 0;
            for (const req of acceptedRequests) {
                const friendId = req.from_user_id === currentUser.id ? req.to_user_id : req.from_user_id;

                // Insert friendship (current user -> friend)
                const { error: err1 } = await supabase.from('friendships').insert({
                    user_id: currentUser.id,
                    friend_id: friendId
                });

                if (!err1 || err1.code === '23505') { // Success or duplicate
                    repaired++;
                }
            }

            console.log(`Repaired ${repaired} friendships`);
            return repaired;
        } catch (e) {
            console.error('Error repairing friendships:', e);
            return 0;
        }
    },

    /**
     * Search users by email, username, or friend code (ID prefix)
     */
    async searchUsers(query: string): Promise<Friend[]> {
        if (!query || query.length < 1) return [];

        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return [];

            // Normalize query - friend codes are uppercase but UUIDs are lowercase
            const normalizedQuery = query.toLowerCase().trim();

            const allMatches = new Map<string, any>();

            // Method 1: Try RPC function for proper UUID text search (if RPC exists)
            try {
                const { data: rpcResults, error: rpcError } = await supabase
                    .rpc('search_profiles_by_code', {
                        search_code: normalizedQuery,
                        current_user_id: currentUser.id
                    });

                if (!rpcError && rpcResults && rpcResults.length > 0) {
                    rpcResults.forEach((u: any) => allMatches.set(u.id, u));
                    console.log(`RPC search found ${rpcResults.length} results`);
                }
            } catch (rpcErr) {
                // RPC not available, continue to fallback
            }

            // Method 2: Fallback - fetch profiles and filter client-side by ID prefix
            if (allMatches.size === 0 && normalizedQuery.length >= 8) {
                // Only do this expensive operation for friend codes (8+ chars)
                const { data: allProfiles } = await supabase
                    .from('profiles')
                    .select('id, username, email, avatar_url')
                    .neq('id', currentUser.id)
                    .limit(200);

                // Filter by ID prefix (friend code) on client side
                (allProfiles || []).forEach(u => {
                    if (u.id.toLowerCase().startsWith(normalizedQuery)) {
                        allMatches.set(u.id, u);
                    }
                });

                if (allMatches.size > 0) {
                    console.log(`Client-side ID search found ${allMatches.size} results`);
                }
            }

            // Method 3: Also search by username/email (case insensitive)
            const { data: textMatches } = await supabase
                .from('profiles')
                .select('id, username, email, avatar_url')
                .or(`email.ilike.%${query}%,username.ilike.%${query}%`)
                .neq('id', currentUser.id)
                .limit(10);

            (textMatches || []).forEach(u => {
                if (!allMatches.has(u.id)) allMatches.set(u.id, u);
            });

            console.log(`Total search results: ${allMatches.size}`);

            return Array.from(allMatches.values()).map(u => ({
                id: u.id,
                username: u.username || u.email?.split('@')[0] || 'User',
                email: u.email || '',
                avatarUrl: u.avatar_url,
                currentStreak: 0,
                todayCompletion: 0,
            }));
        } catch (e) {
            console.log('Friend search error:', e);
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

            const currentUser = await this.getCurrentUser();
            if (!currentUser) return false;

            console.log(`acceptFriendRequest: Current user = ${currentUser.id}, From = ${request.from_user_id}`);

            // Update request status
            const { error: updateError } = await supabase
                .from('friend_requests')
                .update({ status: 'accepted' })
                .eq('id', requestId);

            if (updateError) {
                console.error('Error updating friend request status:', updateError);
            }

            // Try RPC function first (bypasses RLS for bidirectional insert)
            let friendshipCreated = false;
            try {
                const { data: rpcResult, error: rpcError } = await supabase
                    .rpc('create_friendship', {
                        user1_id: currentUser.id,
                        user2_id: request.from_user_id
                    });

                if (!rpcError && rpcResult) {
                    console.log('Friendship created via RPC!');
                    friendshipCreated = true;
                } else if (rpcError) {
                    console.log('RPC not available, using fallback:', rpcError.message);
                }
            } catch (rpcErr) {
                console.log('RPC function not found, using direct insert fallback');
            }

            // Fallback: Direct inserts (may only create one direction due to RLS)
            if (!friendshipCreated) {
                // Insert where current user is user_id (will succeed with RLS)
                const { error: insertError1 } = await supabase.from('friendships').insert({
                    user_id: currentUser.id,
                    friend_id: request.from_user_id
                });

                if (insertError1 && insertError1.code !== '23505') { // Ignore duplicate
                    console.error('Error creating friendship:', insertError1);
                } else {
                    console.log('Friendship created (single direction)');
                }
            }

            console.log('Friend request accepted!');
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
     * Queries both directions of the friendship relationship
     */
    async getFriends(): Promise<Friend[]> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) {
                console.log('getFriends: No current user');
                return [];
            }

            console.log(`getFriends: Current user ID = ${currentUser.id}`);

            // 1. Get Friendship IDs (Raw, no joins)
            const [outgoing, incoming] = await Promise.all([
                supabase
                    .from('friendships')
                    .select('friend_id')
                    .eq('user_id', currentUser.id),
                supabase
                    .from('friendships')
                    .select('user_id')
                    .eq('friend_id', currentUser.id)
            ]);

            console.log(`getFriends: Outgoing query result:`, outgoing.data, outgoing.error);
            console.log(`getFriends: Incoming query result:`, incoming.data, incoming.error);

            const friendIds = new Set<string>();
            (outgoing.data || []).forEach((row: any) => {
                if (row.friend_id) friendIds.add(row.friend_id);
            });
            (incoming.data || []).forEach((row: any) => {
                if (row.user_id) friendIds.add(row.user_id);
            });

            console.log(`getFriends: Found ${friendIds.size} friend IDs:`, Array.from(friendIds));

            if (friendIds.size === 0) return [];

            // 2. Fetch Profiles separately
            const idArray = Array.from(friendIds);
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, username, email, avatar_url')
                .in('id', idArray);

            console.log(`getFriends: Profiles result:`, JSON.stringify(profiles), profileError);

            const profilesMap = new Map();
            (profiles || []).forEach((p: any) => profilesMap.set(p.id, p));

            // 3. Construct Result
            const result = idArray.map(id => {
                const profile = profilesMap.get(id);
                // Better username extraction: prefer username, then email prefix, then ID prefix
                const extractedUsername = profile?.username
                    || (profile?.email ? profile.email.split('@')[0] : null)
                    || `user_${id.substring(0, 6)}`;

                console.log(`getFriends: Friend ${id} -> username: ${profile?.username}, email: ${profile?.email}, extracted: ${extractedUsername}`);

                return {
                    id: id,
                    username: extractedUsername,
                    email: profile?.email || '',
                    avatarUrl: profile?.avatar_url,
                    currentStreak: 0,
                    todayCompletion: 0,
                    // bio stored locally, not in DB
                };
            });

            console.log(`getFriends: Returning ${result.length} friends`);
            return result;
        } catch (e) {
            console.log('Friends list not available:', e);
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
     * Nudge a friend (send notification to their inbox)
     */
    async nudgeFriend(friendId: string, friendName: string): Promise<boolean> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return false;

            // Get current user's profile for the nudge message
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', currentUser.id)
                .single();

            const senderName = userProfile?.username || currentUser.email?.split('@')[0] || 'A friend';

            // Store nudge notification in Supabase for the friend
            const { error: insertError } = await supabase
                .from('notifications')
                .insert({
                    user_id: friendId,
                    type: 'nudge',
                    title: `${senderName} nudged you! 👋`,
                    body: `${senderName} is checking in on your progress. Keep up the good work!`,
                    from_user_id: currentUser.id,
                    read: false,
                    created_at: new Date().toISOString(),
                });

            if (insertError) {
                // If notifications table doesn't exist, create it or fall back
                console.log('Nudge notification insert error:', insertError);
                // Fallback: try to send push notification
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('push_token')
                    .eq('id', friendId)
                    .single();

                if (profile?.push_token) {
                    console.log(`Sending push nudge to ${friendName}`);

                    try {
                        await fetch('https://exp.host/--/api/v2/push/send', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                to: profile.push_token,
                                sound: 'default',
                                title: `${senderName} nudged you! 👋`,
                                body: "Time to check in on your habits!",
                                data: { type: 'nudge', fromUserId: currentUser.id },
                            }),
                        });
                    } catch (pushError) {
                        console.error('Error sending push notification:', pushError);
                    }
                }
            }

            return true;
        } catch (e) {
            console.error('Nudge failed:', e);
            return false;
        }
    },

    /**
     * Get leaderboard with real friend stats
     * @param period - 'week' | 'month' | 'year' | 'all'
     */
    async getLeaderboard(period: 'week' | 'month' | 'year' | 'all' = 'week'): Promise<{ rank: number; friend: Friend }[]> {
        try {
            const friends = await this.getFriends();
            const currentUser = await this.getCurrentUser();

            if (!currentUser) return [];

            // Calculate date range based on period
            const now = new Date();
            let startDate: string;

            if (period === 'week') {
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                startDate = weekAgo.toISOString().split('T')[0];
            } else if (period === 'month') {
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                startDate = monthAgo.toISOString().split('T')[0];
            } else if (period === 'year') {
                const yearAgo = new Date(now);
                yearAgo.setFullYear(now.getFullYear() - 1);
                startDate = yearAgo.toISOString().split('T')[0];
            } else {
                startDate = '2000-01-01'; // All time
            }

            // Get all friend user IDs including current user
            const allUserIds = [...friends.map(f => f.id), currentUser.id];

            // Batch query: Get all habits for all users
            const { data: allHabits } = await supabase
                .from('habits')
                .select('id, user_id')
                .in('user_id', allUserIds)
                .eq('is_archived', false);

            const habitIds = allHabits?.map(h => h.id) || [];
            const userHabitMap: Record<string, string[]> = {};
            allHabits?.forEach(h => {
                if (!userHabitMap[h.user_id]) userHabitMap[h.user_id] = [];
                userHabitMap[h.user_id].push(h.id);
            });

            // Batch query: Get all completions in the period for all habits
            const { data: allCompletions } = await supabase
                .from('habit_completions')
                .select('habit_id, date')
                .in('habit_id', habitIds)
                .gte('date', startDate);

            // Calculate completions per user
            const habitToUser: Record<string, string> = {};
            allHabits?.forEach(h => { habitToUser[h.id] = h.user_id; });

            const userCompletionCount: Record<string, number> = {};
            allCompletions?.forEach(c => {
                const userId = habitToUser[c.habit_id];
                if (userId) {
                    userCompletionCount[userId] = (userCompletionCount[userId] || 0) + 1;
                }
            });

            // Get current user's profile info
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', currentUser.id)
                .single();

            // Build all users list with completion counts
            const allUsers: Friend[] = [
                ...friends.map(f => ({
                    ...f,
                    currentStreak: userCompletionCount[f.id] || 0,
                })),
                {
                    id: currentUser.id,
                    username: userProfile?.username || currentUser.email?.split('@')[0] || 'Me',
                    email: currentUser.email || '',
                    currentStreak: userCompletionCount[currentUser.id] || 0,
                    todayCompletion: 0,
                    avatarUrl: userProfile?.avatar_url,
                    isCurrentUser: true,
                }
            ];

            // Sort by completion count
            allUsers.sort((a, b) => b.currentStreak - a.currentStreak);

            return allUsers.map((friend, index) => ({
                rank: index + 1,
                friend,
            }));
        } catch (e) {
            console.error('Leaderboard error:', e);
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

            // 1. Get Shared IDs
            const { data: shares, error } = await supabase
                .from('shared_habits')
                .select('habit_id, owner_id')
                .eq('shared_with_id', currentUser.id);

            if (error || !shares || shares.length === 0) return [];

            // 2. Collect IDs
            const habitIds = Array.from(new Set(shares.map(s => s.habit_id)));
            const ownerIds = Array.from(new Set(shares.map(s => s.owner_id)));

            // 3. Fetch Data Separately
            const [habitsResult, profilesResult] = await Promise.all([
                supabase.from('habits').select('id, name, icon, category').in('id', habitIds),
                supabase.from('profiles').select('id, username').in('id', ownerIds)
            ]);

            const habitsMap = new Map(habitsResult.data?.map(h => [h.id, h]));
            const ownersMap = new Map(profilesResult.data?.map(p => [p.id, p]));

            // 4. Map Results
            return shares.map(share => {
                const habit = habitsMap.get(share.habit_id);
                const owner = ownersMap.get(share.owner_id);

                if (!habit) return null; // Skip if habit deleted

                return {
                    habit: {
                        id: habit.id,
                        name: habit.name,
                        icon: habit.icon,
                        category: habit.category,
                    },
                    owner: {
                        id: share.owner_id,
                        username: owner?.username || 'Unknown Friend',
                    },
                    todayCompleted: false,
                };
            }).filter(item => item !== null);
        } catch (e) {
            return [];
        }
    },

    /**
     * Share a goal with a friend
     */
    async shareGoalWithFriend(goalId: string, friendId: string): Promise<boolean> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return false;

            const { error } = await supabase
                .from('shared_goals')
                .insert({
                    goal_id: goalId,
                    owner_id: currentUser.id,
                    shared_with_id: friendId,
                });

            if (error) {
                if (isTableMissing(error)) return false;
                console.error('Error sharing goal:', error);
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Unshare a goal with a friend
     */
    async unshareGoal(goalId: string, friendId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('shared_goals')
                .delete()
                .eq('goal_id', goalId)
                .eq('shared_with_id', friendId);

            return !error;
        } catch (e) {
            return false;
        }
    },

    /**
     * Get goals shared with me
     */
    async getGoalsSharedWithMe(): Promise<any[]> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return [];

            const { data: shares, error } = await supabase
                .from('shared_goals')
                .select('goal_id, owner_id')
                .eq('shared_with_id', currentUser.id);

            if (error || !shares || shares.length === 0) return [];

            const goalIds = Array.from(new Set(shares.map(s => s.goal_id)));
            const ownerIds = Array.from(new Set(shares.map(s => s.owner_id)));

            const [goalsResult, profilesResult] = await Promise.all([
                supabase.from('habits').select('id, name, icon, category, target_date').in('id', goalIds),
                supabase.from('profiles').select('id, username').in('id', ownerIds)
            ]);

            const goalsMap = new Map(goalsResult.data?.map(g => [g.id, g]));
            const ownersMap = new Map(profilesResult.data?.map(p => [p.id, p]));

            return shares.map(share => {
                const goal = goalsMap.get(share.goal_id);
                const owner = ownersMap.get(share.owner_id);

                if (!goal) return null;

                return {
                    goal: {
                        id: goal.id,
                        name: goal.name,
                        icon: goal.icon,
                        category: goal.category,
                        deadline: goal.target_date,
                    },
                    owner: {
                        id: share.owner_id,
                        username: owner?.username || 'Unknown Friend',
                    },
                };
            }).filter(item => item !== null);
        } catch (e) {
            return [];
        }
    },

    /**
     * Get goals I have shared with friends
     */
    async getGoalsIShared(): Promise<any[]> {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return [];

            const { data: shares, error } = await supabase
                .from('shared_goals')
                .select('goal_id, shared_with_id')
                .eq('owner_id', currentUser.id);

            if (error || !shares || shares.length === 0) return [];

            const goalIds = Array.from(new Set(shares.map(s => s.goal_id)));
            const friendIds = Array.from(new Set(shares.map(s => s.shared_with_id)));

            const [goalsResult, profilesResult] = await Promise.all([
                supabase.from('habits').select('id, name, icon, category, target_date').in('id', goalIds),
                supabase.from('profiles').select('id, username, avatar_url').in('id', friendIds)
            ]);

            const goalsMap = new Map(goalsResult.data?.map(g => [g.id, g]));
            const friendsMap = new Map(profilesResult.data?.map(p => [p.id, p]));

            // Group shares by goal to show all friends it's shared with
            const goalSharesMap = new Map<string, string[]>();
            shares.forEach(share => {
                if (!goalSharesMap.has(share.goal_id)) {
                    goalSharesMap.set(share.goal_id, []);
                }
                goalSharesMap.get(share.goal_id)!.push(share.shared_with_id);
            });

            return Array.from(goalSharesMap.entries()).map(([goalId, sharedWithIds]) => {
                const goal = goalsMap.get(goalId);
                if (!goal) return null;

                const sharedWith = sharedWithIds.map(id => {
                    const friend = friendsMap.get(id);
                    return {
                        id,
                        username: friend?.username || 'Friend',
                        avatarUrl: friend?.avatar_url,
                    };
                });

                return {
                    goal: {
                        id: goal.id,
                        name: goal.name,
                        icon: goal.icon,
                        category: goal.category,
                        deadline: goal.target_date,
                    },
                    sharedWith,
                    isOwner: true,
                };
            }).filter(item => item !== null);
        } catch (e) {
            return [];
        }
    },

    /**
     * Get friends a goal is shared with (for showing avatars on GoalCard)
     */
    async getGoalSharedWith(goalId: string): Promise<Friend[]> {
        try {
            const { data, error } = await supabase
                .from('shared_goals')
                .select(`
                    shared_with_id,
                    profiles:shared_with_id (id, username, email, avatar_url)
                `)
                .eq('goal_id', goalId);

            if (error) {
                if (isTableMissing(error)) return [];
                return [];
            }

            return (data || []).map(row => {
                const profile = (row as any).profiles;
                if (!profile) return null;
                return {
                    id: profile.id,
                    username: profile.username || 'Friend',
                    email: profile.email || '',
                    avatarUrl: profile.avatar_url,
                    currentStreak: 0,
                    todayCompletion: 0,
                };
            }).filter(Boolean) as Friend[];
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
     * OPTIMIZED: Uses batch queries instead of per-friend loops
     */
    async getFriendsWithProgress(): Promise<Friend[]> {
        const friends = await this.getFriends();
        if (friends.length === 0) return [];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const friendIds = friends.map(f => f.id);

        // Get last 7 days for streak calculation
        const last7Days: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }

        try {
            // Batch query: Get all friends' habits in ONE query
            const { data: allHabits } = await supabase
                .from('habits')
                .select('id, user_id')
                .in('user_id', friendIds)
                .eq('is_archived', false);

            const allHabitIds = allHabits?.map(h => h.id) || [];

            // Batch query: Get last 7 days completions for streak calc
            const { data: recentCompletions } = await supabase
                .from('habit_completions')
                .select('habit_id, date')
                .in('habit_id', allHabitIds)
                .in('date', last7Days);

            // Build lookup maps
            const habitsByUser = new Map<string, string[]>();
            for (const habit of allHabits || []) {
                if (!habitsByUser.has(habit.user_id)) {
                    habitsByUser.set(habit.user_id, []);
                }
                habitsByUser.get(habit.user_id)!.push(habit.id);
            }

            // Group completions by date and habit
            const completionsByDateHabit = new Map<string, Set<string>>();
            for (const comp of recentCompletions || []) {
                const key = comp.date;
                if (!completionsByDateHabit.has(key)) {
                    completionsByDateHabit.set(key, new Set());
                }
                completionsByDateHabit.get(key)!.add(comp.habit_id);
            }

            // Calculate stats for each friend
            const friendsWithStats = friends.map(friend => {
                const userHabits = habitsByUser.get(friend.id) || [];
                const totalHabits = userHabits.length;

                // Today's completion
                const todayCompletedSet = completionsByDateHabit.get(todayStr) || new Set();
                const completedToday = userHabits.filter(hId => todayCompletedSet.has(hId)).length;
                const todayCompletion = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

                // Calculate weekly activity (7 days of completion percentages)
                const weeklyActivity: number[] = last7Days.map(day => {
                    const dayCompletions = completionsByDateHabit.get(day) || new Set();
                    const dayCompleted = userHabits.filter(hId => dayCompletions.has(hId)).length;
                    return totalHabits > 0 ? Math.round((dayCompleted / totalHabits) * 100) : 0;
                });

                // Calculate real streak (consecutive days with >50% completion)
                let streak = 0;
                for (let i = 0; i < last7Days.length; i++) {
                    const dayRate = weeklyActivity[i];

                    if (dayRate >= 50) {
                        streak++;
                    } else if (i > 0) {
                        // Break if not consecutive (except today which might be in progress)
                        break;
                    }
                }

                // Best streak is at least the current streak (we'd need historical data for true best)
                const bestStreak = Math.max(streak, friend.currentStreak || 0);

                return {
                    ...friend,
                    todayCompletion,
                    currentStreak: streak,
                    bestStreak,
                    weeklyActivity,
                };
            });

            return friendsWithStats;
        } catch (e) {
            console.error('Error fetching friend stats:', e);
            return friends;
        }
    },

    /**
     * Get detailed stats for a single friend
     */
    async getFriendDetailedStats(friendId: string): Promise<{
        totalHabits: number;
        completedToday: number;
        totalGoals: number;
        weeklyActivity: boolean[];
        longestStreak: number;
    } | null> {
        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            // Get last 7 days
            const last7Days: string[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                last7Days.push(d.toISOString().split('T')[0]);
            }

            // Get friend's habits
            const { data: habits } = await supabase
                .from('habits')
                .select('id, is_goal')
                .eq('user_id', friendId)
                .eq('is_archived', false);

            const habitIds = habits?.filter(h => !h.is_goal).map(h => h.id) || [];
            const totalHabits = habitIds.length;
            const totalGoals = habits?.filter(h => h.is_goal).length || 0;

            // Get last 7 days completions
            const { data: completions } = await supabase
                .from('habit_completions')
                .select('habit_id, date')
                .in('habit_id', habitIds)
                .in('date', last7Days);

            // Group by date
            const completionsByDate = new Map<string, Set<string>>();
            for (const comp of completions || []) {
                if (!completionsByDate.has(comp.date)) {
                    completionsByDate.set(comp.date, new Set());
                }
                completionsByDate.get(comp.date)!.add(comp.habit_id);
            }

            // Calculate today's completions
            const todaySet = completionsByDate.get(todayStr) || new Set();
            const completedToday = habitIds.filter(hId => todaySet.has(hId)).length;

            // Calculate weekly activity (true if >50% completed that day)
            const weeklyActivity = last7Days.map(day => {
                const daySet = completionsByDate.get(day) || new Set();
                const dayCompleted = habitIds.filter(hId => daySet.has(hId)).length;
                const rate = totalHabits > 0 ? dayCompleted / totalHabits : 0;
                return rate >= 0.5;
            });

            // Calculate streak
            let streak = 0;
            for (let i = 0; i < last7Days.length; i++) {
                if (weeklyActivity[i]) {
                    streak++;
                } else if (i > 0) {
                    break;
                }
            }

            return {
                totalHabits,
                completedToday,
                totalGoals,
                weeklyActivity,
                longestStreak: streak, // We'd need historical data for true longest
            };
        } catch (e) {
            console.error('Error getting friend detailed stats:', e);
            return null;
        }
    },
};
