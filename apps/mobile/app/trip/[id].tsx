import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Artwork from "@/components/ui/Artwork";
import { getSortedTripStops } from "@/components/trip/tripMapUtils";
import { theme } from "@/constants/theme";
import { font } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import {
  getTrip,
  type TripDetailResponse,
  type TripVisibility,
} from "@/services/trips";
import {
  buildTripEditParams,
  buildTripReturnTarget,
  getTripRouteSource,
} from "@/utils/tripNavigation";
import TripStopsMap from "../../components/trip/TripStopsMap";

// ── Helpers ───────────────────────────────────────────────────────────────────

function capFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "T";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (name[0] ?? "T").toUpperCase();
}

function getVisibilityConfig(visibility: TripVisibility) {
  if (visibility === "PUBLIC") {
    return {
      bg: "#E8F7EE",
      border: "#BBE7CA",
      text: "#166534",
      label: "Public",
    };
  }
  return {
    bg: "#F1F5F9",
    border: "#CBD5E1",
    text: "#475569",
    label: "Private",
  };
}

// ── PageHeader ────────────────────────────────────────────────────────────────

function PageHeader({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "T");

  return (
    <View style={[hdrStyles.header, { paddingTop: insets.top }]}>
      <View style={hdrStyles.inner}>
        <View style={hdrStyles.side}>
          <Pressable
            style={({ pressed }) => [
              hdrStyles.iconBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={onBack}
            hitSlop={8}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={theme.colors.primaryDark}
            />
          </Pressable>
        </View>
        <Text style={hdrStyles.wordmark} numberOfLines={1}>
          TRIPCHOLIC
        </Text>
        <View style={[hdrStyles.side, hdrStyles.sideRight]}>
          <View style={hdrStyles.avatar}>
            <Text style={hdrStyles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const hdrStyles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  inner: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  side: {
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideRight: { alignItems: "flex-end" },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    flex: 1,
    textAlign: "center",
    fontFamily: font.bold,
    fontSize: 15,
    letterSpacing: 3,
    color: theme.colors.primaryDark,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    color: "#FFFFFF",
  },
});

// ── OwnerHeroSection ──────────────────────────────────────────────────────────

type OwnerHeroProps = {
  detail: TripDetailResponse;
  ownerName: string | null;
  ownerInitials: string;
};

function OwnerHeroSection({
  detail,
  ownerName,
  ownerInitials,
}: OwnerHeroProps) {
  const imageUrl = detail.preview.imageUrl?.trim() || null;
  const visConfig = getVisibilityConfig(detail.trip.visibility);

  const categories = Array.from(
    new Set(
      [detail.preview.primaryCategory, ...detail.trip.categories].filter(
        (c): c is string => Boolean(c),
      ),
    ),
  ).map(capFirst);

  const creatorName = ownerName?.trim() || "Tripcholic traveler";

  return (
    <View style={ownerHeroStyles.container}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Artwork kind="trip" variant="cover" label={detail.trip.title} />
      )}

      {/* Visibility badge — top right */}
      <View style={ownerHeroStyles.visBadge}>
        <View
          style={[
            ownerHeroStyles.visPill,
            { backgroundColor: visConfig.bg, borderColor: visConfig.border },
          ]}
        >
          <Text
            style={[ownerHeroStyles.visPillText, { color: visConfig.text }]}
          >
            {visConfig.label}
          </Text>
        </View>
      </View>

      <View style={ownerHeroStyles.scrim} />

      <View style={ownerHeroStyles.bottomContent}>
        <Text style={ownerHeroStyles.title} numberOfLines={3}>
          {detail.trip.title}
        </Text>

        {categories.length > 0 && (
          <Text style={ownerHeroStyles.categories}>
            {categories.join(", ")}
          </Text>
        )}

        {/* Creator bar + You pill + date */}
        <View style={ownerHeroStyles.creatorRow}>
          <View style={ownerHeroStyles.creatorBar}>
            <View style={ownerHeroStyles.creatorAvatar}>
              <Text style={ownerHeroStyles.creatorInitials}>
                {ownerInitials}
              </Text>
            </View>
            <View style={ownerHeroStyles.creatorInfo}>
              <Text style={ownerHeroStyles.creatorName} numberOfLines={1}>
                {creatorName}
              </Text>
              <Text style={ownerHeroStyles.creatorSub}>Your trip</Text>
            </View>
            {/* "You" pill — mirrors the Following button style */}
            <View style={ownerHeroStyles.youPill}>
              <Text style={ownerHeroStyles.youPillText}>You</Text>
            </View>
          </View>

          <View style={ownerHeroStyles.datePill}>
            <Text style={ownerHeroStyles.datePillText}>
              {formatDateLabel(detail.trip.date)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const ownerHeroStyles = StyleSheet.create({
  container: {
    height: 432,
    overflow: "hidden",
    backgroundColor: theme.colors.primaryDark,
  },
  scrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(11,36,48,0.80)",
  },
  visBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
  },
  visPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  visPillText: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
    gap: 4,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 26,
    lineHeight: 32,
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  categories: {
    fontFamily: font.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 0.1,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  creatorBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 0,
  },
  creatorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  creatorInitials: {
    fontFamily: font.bold,
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  creatorInfo: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  creatorName: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: "rgba(255,255,255,0.92)",
  },
  creatorSub: {
    fontFamily: font.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
  },
  youPill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  youPillText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  datePill: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 64,
  },
  datePillText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    textAlign: "right",
    lineHeight: 16,
  },
});

// ── TimelineItem ──────────────────────────────────────────────────────────────

type StopData = TripDetailResponse["stops"][number];

function TimelineItem({ stop, isLast }: { stop: StopData; isLast: boolean }) {
  const imageUrl = stop.poi.imageUrl?.trim() || null;
  const poiName =
    stop.poi.title.trim() || stop.title.trim() || `Stop ${stop.order}`;
  const description =
    stop.poi.description?.trim() ||
    `${capFirst(stop.poi.category)} spot${stop.poi.district ? ` in ${stop.poi.district}` : ""}.`;

  return (
    <View style={tlStyles.row}>
      <View style={tlStyles.markerCol}>
        <View style={tlStyles.dot}>
          <Ionicons name="location" size={11} color="#FFFFFF" />
        </View>
        {!isLast && <View style={tlStyles.line} />}
      </View>
      <View style={[tlStyles.card, isLast && tlStyles.cardLast]}>
        <View style={tlStyles.topRow}>
          <Text style={tlStyles.stopTime}>{stop.arrivalTime}</Text>
          <View style={tlStyles.categoryBadge}>
            <Text style={tlStyles.categoryText}>
              {capFirst(stop.poi.category)}
            </Text>
          </View>
        </View>
        <Text style={tlStyles.poiName} numberOfLines={2}>
          {poiName}
        </Text>
        <Image
          source={
            imageUrl
              ? { uri: imageUrl }
              : require("../../assets/images/placeholders/default-poi.png")
          }
          style={tlStyles.poiImage}
          contentFit="cover"
          transition={150}
        />
        <Text style={tlStyles.description} numberOfLines={3}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  markerCol: { width: 28, alignItems: "center", alignSelf: "stretch" },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    flexShrink: 0,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.primary,
    opacity: 0.25,
    marginTop: 4,
  },
  card: { flex: 1, paddingLeft: 14, paddingBottom: 24, gap: 8 },
  cardLast: { paddingBottom: 4 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stopTime: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 0.1,
  },
  categoryBadge: {
    backgroundColor: "#DFF7F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontFamily: font.bold,
    fontSize: 10,
    color: "#006A69",
    letterSpacing: 0.2,
  },
  poiName: {
    fontFamily: font.bold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    marginTop: -2,
  },
  poiImage: { height: 252, borderRadius: 12 },
  description: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function OwnerTripDetailScreen() {
  const router = useRouter();
  const { id, source, returnTripId } = useLocalSearchParams<{
    id?: string;
    source?: string;
    returnTripId?: string;
  }>();
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const returnTarget = buildTripReturnTarget({ source, returnTripId });
  const routeSource = getTripRouteSource(source);

  const loadTrip = useCallback(async () => {
    if (isAuthLoading) return;
    if (!token) {
      setError("Authentication required. Please sign in again.");
      setIsLoading(false);
      return;
    }
    if (!id || typeof id !== "string") {
      setError("Missing trip id.");
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await getTrip(token, id);
      setTripDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load trip.");
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthLoading, token]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  const sortedStops = useMemo(
    () => getSortedTripStops(tripDetail?.stops ?? []),
    [tripDetail?.stops],
  );

  const ownerName = user?.displayName ?? null;
  const ownerInitials = getInitials(user?.displayName ?? user?.email);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <PageHeader onBack={() => router.back()} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading trip…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error || !tripDetail) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <PageHeader onBack={() => router.back()} />
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.stateTitle}>Trip Unavailable</Text>
          <Text style={styles.stateText}>
            {error ?? "This trip could not be loaded."}
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace(returnTarget.href)}
          >
            <Text style={styles.primaryBtnText}>{returnTarget.label}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const tripIdStr = typeof id === "string" ? id : "";

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <PageHeader onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <OwnerHeroSection
          detail={tripDetail}
          ownerName={ownerName}
          ownerInitials={ownerInitials}
        />

        {/* Edit Trip CTA — between hero and details */}
        <View style={styles.editBtnWrapper}>
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              pressed && { opacity: 0.82 },
            ]}
            onPress={() =>
              router.push(
                buildTripEditParams(tripIdStr, {
                  ...(routeSource ? { source: routeSource } : {}),
                  ...(typeof returnTripId === "string" ? { returnTripId } : {}),
                }),
              )
            }
          >
            <Ionicons name="pencil-outline" size={17} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Edit Trip</Text>
          </Pressable>
        </View>

        {/* ── Content block 1 ─────────────────────────────────────────────── */}
        <View style={styles.content}>
          {/* Metrics grid */}
          <View style={styles.metricsGrid}>
            {(
              [
                {
                  icon: "location-outline" as const,
                  label: "Stops",
                  value: String(tripDetail.optimization.stopCount),
                },
                {
                  icon: "time-outline" as const,
                  label: "Duration",
                  value:
                    tripDetail.optimization.routeTotalDurationMin !== null
                      ? `${tripDetail.optimization.routeTotalDurationMin} min`
                      : "—",
                },
                {
                  icon: "cash-outline" as const,
                  label: "Est. Cost",
                  value:
                    tripDetail.optimization.routeTotalCostTl !== null
                      ? `${tripDetail.optimization.routeTotalCostTl} TL`
                      : "—",
                },
                {
                  icon: "walk-outline" as const,
                  label: "Distance",
                  value:
                    tripDetail.optimization.routeTotalDistanceKm !== null
                      ? `${tripDetail.optimization.routeTotalDistanceKm} km`
                      : "—",
                },
              ] as const
            ).map(({ icon, label, value }) => (
              <View key={label} style={styles.metricCell}>
                <View style={styles.metricIconCircle}>
                  <Ionicons
                    name={icon}
                    size={16}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.metricValue}>{value}</Text>
                <Text style={styles.metricLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapSection}>
          <TripStopsMap stops={tripDetail.stops} />
        </View>

        {/* ── Content block 2 ─────────────────────────────────────────────── */}
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>ITINERARY</Text>
            <Text style={styles.sectionTitle}>Trip stops</Text>
          </View>

          {sortedStops.length > 0 ? (
            <View>
              {sortedStops.map((stop, index) => (
                <TimelineItem
                  key={stop.id}
                  stop={stop}
                  isLast={index === sortedStops.length - 1}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No stops available for this trip yet.
              </Text>
            </View>
          )}

          {tripDetail.optimization.routeExplanation ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Why this route works</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.routeText}>
                  {tripDetail.optimization.routeExplanation}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingBottom: 48 },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
  },

  mapSection: {
    marginTop: 24,
    marginBottom: 4,
    marginHorizontal: 16,
  },

  // Edit button strip
  editBtnWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 16,
    height: 50,
  },
  editBtnText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  // States
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  stateTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    color: theme.colors.primaryDark,
    textAlign: "center",
  },
  stateText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },

  // Metrics
  metricsGrid: { flexDirection: "row", gap: 8 },
  metricCell: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 6,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DFF7F6",
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontFamily: font.bold,
    fontSize: 13,
    color: theme.colors.primaryDark,
    textAlign: "center",
  },
  metricLabel: {
    fontFamily: font.medium,
    fontSize: 10,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },

  // Section headers
  sectionHeader: { gap: 2, marginTop: 4 },
  sectionEyebrow: {
    fontFamily: font.bold,
    fontSize: 10,
    color: theme.colors.primary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 16,
    gap: 12,
  },
  routeText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },

  // Empty state
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 20,
    alignItems: "center",
  },
  emptyStateText: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },

  // Primary button
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 24,
  },
  primaryBtnText: {
    fontFamily: font.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },
});
