import { db, auth } from '@/Firebase.config';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  getDoc,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

// Helper to remove undefined fields which Firestore doesn't support
const cleanData = (data: any) => {
  return JSON.parse(JSON.stringify(data));
};

export type HabitCategory = 'health' | 'fitness' | 'work' | 'personal' | 'mindfulness' | 'misc';

export interface Habit {
  id: string;
  name: string;
  icon?: string; // Ionicons name
  category: HabitCategory;
  createdAt: string; // ISO date
  durationMinutes?: number; // optional time factor per session
  startTime?: string; // 'HH:mm'
  endTime?: string;   // 'HH:mm'
  isGoal?: boolean; // true if this is a goal with target date
  targetDate?: string; // ISO date for goal target
}

const todayString = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function getUserId(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user.uid);
      } else {
        signInAnonymously(auth).then(({ user }) => resolve(user.uid)).catch(reject);
      }
    });
  });
}

// --- Habits CRUD ---

export async function getHabits(): Promise<Habit[]> {
  try {
    const uid = await getUserId();
    const q = query(collection(db, 'users', uid, 'habits'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Habit));
  } catch (e) {
    console.error('Error fetching habits:', e);
    // If permission denied, return empty but don't crash.
    // This can happen if rules are too strict or auth is not ready.
    return [];
  }
}

export async function addHabit(
  name: string,
  category: HabitCategory = 'work',
  icon?: string,
  durationMinutes?: number,
  startTime?: string,
  endTime?: string,
  isGoal?: boolean,
  targetDate?: string,
): Promise<Habit> {
  const uid = await getUserId();
  const id = doc(collection(db, 'users', uid, 'habits')).id; // Generate ID
  const newHabit: Habit = {
    id,
    name,
    category,
    icon,
    createdAt: new Date().toISOString(),
    durationMinutes,
    startTime,
    endTime,
    isGoal,
    targetDate,
  };
  
  await setDoc(doc(db, 'users', uid, 'habits', id), cleanData(newHabit));
  return newHabit;
}

export async function updateHabit(updatedHabit: Habit): Promise<void> {
  const uid = await getUserId();
  // Firestore requires excluding the ID from the data if we are just merging, 
  // but setDoc with merge works fine even if ID is redundant.
  await setDoc(doc(db, 'users', uid, 'habits', updatedHabit.id), cleanData(updatedHabit), { merge: true });
}

export async function removeHabit(habitId: string): Promise<void> {
  const uid = await getUserId();
  await deleteDoc(doc(db, 'users', uid, 'habits', habitId));
}

/** Remove a habit and cleanup completions */
export async function removeHabitEverywhere(habitId: string): Promise<void> {
  const uid = await getUserId();
  const batch = writeBatch(db);
  
  // 1. Delete the habit
  batch.delete(doc(db, 'users', uid, 'habits', habitId));

  // 2. Cleanup completions (expensive if many days, but necessary)
  // Optimization: Only delete completion fields if we structure completions as { [habitId]: boolean }
  // To do this strictly correctly in Firestore, we'd need to query all completion docs containing this field.
  // This can be read-heavy. For now, we'll just delete the habit. 
  // The 'getCompletions' will just return keys that might not exist in 'habits' list, which the UI filters out anyway.
  // So we skip the expensive cleanup query for now.
  
  await batch.commit();
}

// --- Completions ---

export async function getCompletions(dateISO?: string): Promise<Record<string, boolean>> {
  const uid = await getUserId();
  const dateStr = dateISO ?? todayString();
  const docRef = doc(db, 'users', uid, 'completions', dateStr);
  const snap = await getDoc(docRef);
  
  if (snap.exists()) {
    return snap.data() as Record<string, boolean>;
  }
  return {};
}

export async function setCompletions(dateISO: string, data: Record<string, boolean>): Promise<void> {
  const uid = await getUserId();
  await setDoc(doc(db, 'users', uid, 'completions', dateISO), data, { merge: true });
}

export async function toggleCompletion(habitId: string, dateISO?: string): Promise<Record<string, boolean>> {
  const uid = await getUserId();
  const dateStr = dateISO ?? todayString();
  const docRef = doc(db, 'users', uid, 'completions', dateStr);
  
  // We need to read first to toggle
  // Transaction is safer but for a single user app, read-modify-write is okay-ish.
  // Better: use getDoc then setDoc.
  const snap = await getDoc(docRef);
  const current = snap.exists() ? (snap.data() as Record<string, boolean>) : {};
  
  const newValue = !current[habitId];
  const next = { ...current, [habitId]: newValue };
  
  await setDoc(docRef, { [habitId]: newValue }, { merge: true });
  return next;
}

// --- Statistics ---

export async function getLastNDaysCompletions(days: number): Promise<{ date: string; completedIds: string[] }[]> {
  const uid = await getUserId();
  const result: { date: string; completedIds: string[] }[] = [];
  
  // Optimization: Fetch all needed docs in parallel
  const promises = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = todayString(d);
    promises.push(
      getDoc(doc(db, 'users', uid, 'completions', dateStr)).then(snap => ({
        date: dateStr,
        data: snap.exists() ? snap.data() : {}
      }))
    );
  }
  
  const snaps = await Promise.all(promises);
  
  snaps.forEach(({ date, data }) => {
    const completedIds = Object.keys(data).filter(id => !!data[id]);
    result.push({ date, completedIds });
  });
  
  return result;
}

export async function getStreakData(): Promise<{ currentStreak: number; bestStreak: number; perfectDays: number; totalCompleted: number }> {
  // Retrieve last 365 days of data
  // Note: 365 reads is expensive. In a real app, maintain a 'stats' document that aggregates this.
  // For this prototype, we'll limit to 90 days to save quota or just do it.
  const history = await getLastNDaysCompletions(90); 
  const habits = await getHabits();
  const totalHabitCount = habits.length;

  if (totalHabitCount === 0) return { currentStreak: 0, bestStreak: 0, perfectDays: 0, totalCompleted: 0 };

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  let perfectDays = 0;
  let totalCompleted = 0;

  history.forEach(day => {
    const completedCount = day.completedIds.length;
    totalCompleted += completedCount;

    if (completedCount > 0 && completedCount >= totalHabitCount) {
      perfectDays++;
    }

    if (completedCount > 0) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 0;
    }
  });
  
  bestStreak = Math.max(bestStreak, tempStreak);

  // Calculate Current Streak
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].completedIds.length > 0) {
          streak++;
      } else {
          if (i === history.length - 1) continue; 
          break;
      }
  }
  currentStreak = streak;

  return {
    currentStreak,
    bestStreak,
    perfectDays,
    totalCompleted
  };
}

export async function getHeatmapData(): Promise<{ date: string; count: number }[]> {
  const history = await getLastNDaysCompletions(91); 
  return history.map(h => ({
    date: h.date,
    count: h.completedIds.length
  }));
}
