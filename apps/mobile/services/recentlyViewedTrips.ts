import AsyncStorage from '@react-native-async-storage/async-storage';
import { type TripPreview } from './trips';

const STORAGE_KEY_PREFIX = 'recently_viewed_trips';
const MAX_ITEMS = 20;

export type RecentlyViewedTrip = {
  id: string;
  title: string;
  preview: TripPreview;
  categories: string[];
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  isOwnTrip: boolean;
  optimizedAt: string | null;
  engagement: {
    likeCount: number;
    commentCount: number;
    saveCount: number;
    likedByMe: boolean;
    savedByMe: boolean;
  };
  viewedAt: string;
};

function storageKey(userId: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

export async function addRecentlyViewedTrip(
  trip: RecentlyViewedTrip,
  userId: string | null = null,
): Promise<void> {
  try {
    const existing = await getRecentlyViewedTrips(userId);
    const filtered = existing.filter((t) => t.id !== trip.id);
    const updated = [trip, ...filtered].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
  } catch {
    // non-critical
  }
}

export async function getRecentlyViewedTrips(
  userId: string | null = null,
): Promise<RecentlyViewedTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as RecentlyViewedTrip[];
  } catch {
    return [];
  }
}

export async function removeRecentlyViewedTrip(
  tripId: string,
  userId: string | null = null,
): Promise<void> {
  try {
    const existing = await getRecentlyViewedTrips(userId);
    const updated = existing.filter((t) => t.id !== tripId);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
  } catch {
    // non-critical
  }
}

export async function pruneStaleRecentlyViewedTrips(
  staleIds: string[],
  userId: string | null = null,
): Promise<void> {
  try {
    const staleSet = new Set(staleIds);
    const existing = await getRecentlyViewedTrips(userId);
    const updated = existing.filter((t) => !staleSet.has(t.id));
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
  } catch {
    // non-critical
  }
}
