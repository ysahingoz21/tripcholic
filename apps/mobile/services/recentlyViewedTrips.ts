import AsyncStorage from '@react-native-async-storage/async-storage';
import { type TripPreview } from './trips';

const STORAGE_KEY = 'recently_viewed_trips';
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

export async function addRecentlyViewedTrip(trip: RecentlyViewedTrip): Promise<void> {
  try {
    const existing = await getRecentlyViewedTrips();
    const filtered = existing.filter((t) => t.id !== trip.id);
    const updated = [trip, ...filtered].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // non-critical
  }
}

export async function getRecentlyViewedTrips(): Promise<RecentlyViewedTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentlyViewedTrip[];
  } catch {
    return [];
  }
}
