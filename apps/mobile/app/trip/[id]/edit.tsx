import { theme } from "@/constants/theme";
import { font } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import {
  getTrip,
  optimizeTrip,
  updateTrip,
  type TripDetailResponse,
  type TripVisibility,
  type UpdateTripPayload,
} from "@/services/trips";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Artwork from "@/components/ui/Artwork";
import {
  buildTripDetailParams,
  buildTripReturnTarget,
  getTripRouteSource,
} from "@/utils/tripNavigation";

// ── Constants ─────────────────────────────────────────────────────────────────

const INTEREST_OPTIONS = [
  "Culture",
  "Food",
  "Museums",
  "Shopping",
  "Nature",
  "Coffee",
  "History",
  "Nightlife",
] as const;

const BUDGET_OPTIONS = [
  {
    key: "low" as const,
    label: "Budget",
    sub: "~₺2,000",
    icon: "wallet-outline" as const,
    desc: "Street food, free sights, affordable cafés",
    value: 2000,
  },
  {
    key: "medium" as const,
    label: "Moderate",
    sub: "~₺6,000",
    icon: "card-outline" as const,
    desc: "Mix of paid attractions and mid-range dining",
    value: 6000,
  },
  {
    key: "high" as const,
    label: "Premium",
    sub: "~₺20,000",
    icon: "diamond-outline" as const,
    desc: "Fine dining, private tours, rooftop venues",
    value: 20000,
  },
] as const;

type BudgetKey = "low" | "medium" | "high" | "";

// Map existing numeric budgetTl → a BudgetKey
function budgetTlToBudgetKey(tl: number | null): BudgetKey {
  if (tl === null) return "";
  if (tl <= 3000) return "low";
  if (tl <= 10000) return "medium";
  return "high";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateForApi(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeForApi(value: Date) {
  const h = String(value.getHours()).padStart(2, "0");
  const min = String(value.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

function toDateValue(date: string) {
  return new Date(`${date}T12:00:00`);
}

function toTimeValue(value: string | null, fallback: string) {
  const [hours, minutes] = (value ?? fallback).split(":").map(Number);
  const base = new Date();
  base.setHours(hours, minutes, 0, 0);
  return base;
}

function normalizeCategories(values: string[]) {
  return [
    ...new Set(values.map((item) => item.toLowerCase().trim()).filter(Boolean)),
  ].sort();
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
  side: { width: 44, alignItems: "flex-start", justifyContent: "center" },
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EditTripScreen() {
  const router = useRouter();
  const { id, remix, source, returnTripId } = useLocalSearchParams<{
    id?: string;
    remix?: string;
    source?: string;
    returnTripId?: string;
  }>();
  const { token, isLoading: isAuthLoading } = useAuth();

  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [budgetKey, setBudgetKey] = useState<BudgetKey>("");
  const [isPublic, setIsPublic] = useState(false);
  // Keep weather + maxWalkingDistanceKm + maxStops in state to preserve on save
  const [weather, setWeather] = useState("");
  const [maxWalkingDistanceKm, setMaxWalkingDistanceKm] = useState<
    number | null
  >(null);
  const [maxStops, setMaxStops] = useState<number | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const tripReturnTarget = buildTripReturnTarget({ source, returnTripId });
  const routeSource = getTripRouteSource(source);

  useEffect(() => {
    async function load() {
      if (isAuthLoading) return;
      if (!token) {
        setError("Authentication required.");
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
        setTitle(data.trip.title);
        setDestination(data.trip.destination ?? "");
        setDescription(data.trip.description ?? "");
        setDate(data.trip.date.slice(0, 10));
        setStartTime(data.trip.timeStart ?? "");
        setEndTime(data.trip.timeEnd ?? "");
        setCategories(data.trip.categories.map((c) => c.toLowerCase()));
        setBudgetKey(budgetTlToBudgetKey(data.trip.budgetTl));
        setIsPublic(data.trip.visibility === "PUBLIC");
        setWeather(data.trip.weather ?? "");
        setMaxWalkingDistanceKm(data.trip.walkingToleranceKm);
        setMaxStops(data.trip.maxPois);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load trip.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [token, id, isAuthLoading]);

  const toggleCategory = (interest: string) => {
    const normalized = interest.toLowerCase();
    setCategories((prev) =>
      prev.includes(normalized)
        ? prev.filter((c) => c !== normalized)
        : [...prev, normalized],
    );
  };

  // Determine if optimization-affecting fields changed (compared to loaded data)
  const hasOptimizationChanges = useMemo(() => {
    if (!tripDetail) return false;
    const orig = tripDetail.trip;
    const newCats = normalizeCategories(categories);
    const origCats = normalizeCategories(orig.categories);
    const selectedBudget =
      BUDGET_OPTIONS.find((b) => b.key === budgetKey)?.value ?? null;
    return (
      destination.trim() !== (orig.destination ?? "").trim() ||
      date !== orig.date.slice(0, 10) ||
      startTime !== (orig.timeStart ?? "") ||
      endTime !== (orig.timeEnd ?? "") ||
      JSON.stringify(newCats) !== JSON.stringify(origCats) ||
      selectedBudget !== orig.budgetTl
    );
  }, [
    tripDetail,
    destination,
    date,
    startTime,
    endTime,
    categories,
    budgetKey,
  ]);

  const primaryActionLabel = hasOptimizationChanges
    ? "Save & Re-optimize"
    : "Save Changes";

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // Fallback for deep-linked entry with no back stack
    const tripId = tripDetail?.trip.id ?? (typeof id === "string" ? id : "");
    router.replace(
      buildTripDetailParams(tripId, {
        ...(routeSource ? { source: routeSource } : {}),
        ...(typeof returnTripId === "string" ? { returnTripId } : {}),
      }),
    );
  };

  const handleSave = async () => {
    if (!token || !id || typeof id !== "string") {
      Alert.alert(
        "Unable to save",
        "Authentication or trip context is missing.",
      );
      return;
    }
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a trip title.");
      return;
    }
    if (!destination.trim()) {
      Alert.alert("Missing destination", "Please enter a destination.");
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert("Invalid date", "Please provide a valid trip date.");
      return;
    }

    const resolvedVisibility: TripVisibility = isPublic ? "PUBLIC" : "PRIVATE";
    const resolvedBudget =
      BUDGET_OPTIONS.find((b) => b.key === budgetKey)?.value ?? undefined;

    const payload: UpdateTripPayload = {
      title: title.trim(),
      destination: destination.trim(),
      description: description.trim() || undefined,
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      categories: normalizeCategories(categories),
      budgetTl: resolvedBudget,
      maxWalkingDistanceKm: maxWalkingDistanceKm ?? undefined,
      maxStops: maxStops ?? undefined,
      weather: weather || undefined,
      visibility: resolvedVisibility,
    };

    try {
      setIsSaving(true);
      setError(null);
      await updateTrip(token, id, payload);
      if (hasOptimizationChanges) {
        await optimizeTrip(token, id);
        router.replace({ pathname: "/results", params: { tripId: id } });
        return;
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(
          buildTripDetailParams(typeof id === "string" ? id : "", {
            ...(routeSource ? { source: routeSource } : {}),
            ...(typeof returnTripId === "string" ? { returnTripId } : {}),
          }),
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to save trip.";
      setError(msg);
      Alert.alert("Unable to save", msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <PageHeader onBack={() => router.back()} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading editor…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !tripDetail) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <PageHeader onBack={() => router.back()} />
        <View style={styles.centerState}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.stateTitle}>Editor unavailable</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.primaryBtn} onPress={handleCancel}>
            <Text style={styles.primaryBtnText}>Back to Trip</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const coverImageUrl = tripDetail?.preview.imageUrl?.trim() || null;

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <PageHeader onBack={handleCancel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Remix notice */}
        {remix === "1" ? (
          <View style={styles.remixNotice}>
            <Ionicons
              name="copy-outline"
              size={15}
              color={theme.colors.primaryDark}
            />
            <Text style={styles.remixNoticeText}>
              This is your own draft copy. Changes only affect your remixed
              trip.
            </Text>
          </View>
        ) : null}

        {/* ── Cover image ────────────────────────────────────────────────── */}
        <View style={styles.coverContainer}>
          {coverImageUrl ? (
            <Image
              source={{ uri: coverImageUrl }}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.coverImage}>
              <Artwork
                kind="trip"
                variant="cover"
                label={tripDetail?.trip.title ?? "Trip"}
              />
            </View>
          )}
          {/* Change Cover overlay — placeholder, non-functional */}
          <View style={styles.changeCoverCenter}>
            <View style={styles.changeCoverOverlay}>
              <Ionicons
                name="image-outline"
                size={16}
                color={theme.colors.primaryDark}
              />
              <Text style={styles.changeCoverText}>Change Cover</Text>
            </View>
          </View>
        </View>

        {/* ── Trip Details section ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>EDIT TRIP</Text>
          <Text style={styles.sectionTitle}>Trip Details</Text>
        </View>

        <View style={styles.card}>
          {/* Trip Title */}
          <Text style={styles.fieldLabel}>Trip Title *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Weekend in Old Istanbul"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            maxLength={120}
            returnKeyType="next"
            autoCorrect={false}
          />
          <Text style={styles.fieldHint}>
            Give your trip a name — you'll see it in your saved trips list.
          </Text>

          <View style={styles.fieldSep} />

          {/* Destination */}
          <Text style={styles.fieldLabel}>Destination *</Text>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="e.g. Kadıköy, Beşiktaş, Sultanahmet"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            returnKeyType="next"
            autoCorrect={false}
          />
          <Text style={styles.fieldHint}>
            We'll recommend places within ~10 km of your destination. Popular:
            Kadıköy · Beşiktaş · Taksim · Sultanahmet · Balat
          </Text>

          <View style={styles.fieldSep} />

          {/* Description */}
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="A short note about what to expect on this trip…"
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            style={styles.textArea}
            maxLength={500}
          />
          <Text style={styles.fieldHint}>
            Optional — visible to you and others if the trip is public.
          </Text>
        </View>

        {/* Date + Time */}
        <View style={styles.card}>
          {/* Date */}
          <Text style={styles.fieldLabel}>Date *</Text>
          <Pressable
            style={styles.inputIconRow}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={date ? theme.colors.primaryDark : "#94A3B8"}
            />
            <Text
              style={[
                styles.inputIconText,
                !date && styles.inputIconPlaceholder,
              ]}
            >
              {date || "Select a date"}
            </Text>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={date ? toDateValue(date) : new Date()}
              mode="date"
              display="default"
              onChange={(_, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(formatDateForApi(selectedDate));
              }}
            />
          ) : null}
          <Text style={styles.fieldHint}>Tap to open the calendar</Text>

          <View style={styles.fieldSep} />

          {/* Available Time */}
          <Text style={styles.fieldLabel}>Available Time</Text>
          <View style={styles.timeRow}>
            <Pressable
              style={[styles.inputIconRow, styles.timeInput]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Ionicons
                name="time-outline"
                size={15}
                color={startTime ? theme.colors.primaryDark : "#94A3B8"}
              />
              <Text
                style={[
                  styles.inputIconText,
                  !startTime && styles.inputIconPlaceholder,
                ]}
              >
                {startTime || "Start"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.inputIconRow, styles.timeInput]}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Ionicons
                name="time-outline"
                size={15}
                color={endTime ? theme.colors.primaryDark : "#94A3B8"}
              />
              <Text
                style={[
                  styles.inputIconText,
                  !endTime && styles.inputIconPlaceholder,
                ]}
              >
                {endTime || "End"}
              </Text>
            </Pressable>
          </View>
          {showStartTimePicker ? (
            <DateTimePicker
              value={toTimeValue(startTime || null, "10:00")}
              mode="time"
              display="default"
              onChange={(_, t) => {
                setShowStartTimePicker(false);
                if (t) setStartTime(formatTimeForApi(t));
              }}
            />
          ) : null}
          {showEndTimePicker ? (
            <DateTimePicker
              value={toTimeValue(endTime || null, "18:00")}
              mode="time"
              display="default"
              onChange={(_, t) => {
                setShowEndTimePicker(false);
                if (t) setEndTime(formatTimeForApi(t));
              }}
            />
          ) : null}
          <Text style={styles.fieldHint}>
            Most sites in Istanbul close between 17:00 – 19:00.
          </Text>
        </View>

        {/* ── Visibility ──────────────────────────────────────────────────── */}
        <View style={styles.visibilityCard}>
          <View style={styles.visibilityIconWrap}>
            <Ionicons
              name="eye-outline"
              size={18}
              color={theme.colors.primaryDark}
            />
          </View>
          <View style={styles.visibilityLeft}>
            <Text style={styles.visibilityLabel}>Public Visibility</Text>
            <Text style={styles.visibilityHint}>
              Allow others to discover and remix this trip
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: "#CBD5E1", true: theme.colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* ── Interests ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <Text style={styles.sectionSub}>
            Pick the types of places to include. Changes here will re-optimize
            your trip.
          </Text>
        </View>

        <View style={styles.chipGrid}>
          {INTEREST_OPTIONS.map((interest) => {
            const isSelected = categories.includes(interest.toLowerCase());
            return (
              <Pressable
                key={interest}
                onPress={() => toggleCategory(interest)}
                style={[
                  styles.interestChip,
                  isSelected && styles.interestChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.interestChipText,
                    isSelected && styles.interestChipTextSelected,
                  ]}
                >
                  {interest}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Budget ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget</Text>
          <Text style={styles.sectionSub}>
            Your spending comfort level — we'll prioritise stops that match.
            Changes here will re-optimize your trip.
          </Text>
        </View>

        <View style={styles.budgetList}>
          {BUDGET_OPTIONS.map(({ key, label, sub, icon, desc }) => {
            const isSelected = budgetKey === key;
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.budgetCard,
                  isSelected && styles.budgetCardSelected,
                  pressed && styles.budgetCardPressed,
                ]}
                onPress={() => setBudgetKey(isSelected ? "" : key)}
              >
                <View
                  style={[
                    styles.budgetIconCircle,
                    isSelected && styles.budgetIconCircleSelected,
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={20}
                    color={isSelected ? "#FFFFFF" : theme.colors.primaryDark}
                  />
                </View>
                <View style={styles.budgetCardBody}>
                  <Text
                    style={[
                      styles.budgetCardLabel,
                      isSelected && styles.budgetCardLabelSelected,
                    ]}
                  >
                    {label}
                  </Text>
                  <Text style={styles.budgetCardSub}>{sub}</Text>
                  <Text style={styles.budgetCardDesc}>{desc}</Text>
                </View>
                <View style={styles.budgetCardCheckSlot}>
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#006A69"
                    style={[
                      styles.budgetCardCheck,
                      !isSelected && styles.budgetCardCheckHidden,
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Inline error */}
        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color="#9A3412" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Bottom actions ───────────────────────────────────────────────── */}
        <View style={styles.ctaGroup}>
          <Pressable
            style={[styles.saveBtn, isSaving && styles.btnDimmed]}
            onPress={() => void handleSave()}
            disabled={isSaving}
          >
            {!isSaving && (
              <Ionicons
                name={hasOptimizationChanges ? "flash-outline" : "checkmark"}
                size={17}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.saveBtnText}>
              {isSaving
                ? hasOptimizationChanges
                  ? "Saving & Re-optimizing…"
                  : "Saving…"
                : primaryActionLabel}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.cancelBtn, isSaving && styles.btnDimmed]}
            onPress={handleCancel}
            disabled={isSaving}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 16,
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
    color: theme.colors.textSecondary,
    textAlign: "center",
  },

  // Remix notice
  remixNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F4FBFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFEAE9",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  remixNoticeText: {
    flex: 1,
    fontFamily: font.semiBold,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.primaryDark,
  },

  // Cover image
  coverContainer: {
    height: 400,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#DFF7F6",
    position: "relative",
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  changeCoverCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  changeCoverOverlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  changeCoverText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
  },

  // Section headers
  section: { gap: 2 },
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
  sectionSub: {
    fontFamily: font.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // Card (wraps related fields)
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    padding: 16,
    gap: 0,
  },
  fieldLabel: {
    fontFamily: font.bold,
    fontSize: 12,
    color: theme.colors.textSecondary,
    letterSpacing: 0.1,
    marginBottom: 8,
    marginTop: 4,
  },
  fieldHint: {
    fontFamily: font.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
    marginTop: 6,
  },
  inputIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8ECF0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputIconText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.text,
  },
  inputIconPlaceholder: {
    color: "#94A3B8",
  },
  fieldSep: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
    marginHorizontal: -16,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8ECF0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.text,
  },
  textArea: {
    minHeight: 96,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8ECF0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.text,
  },
  timeRow: { flexDirection: "row", gap: 10 },
  timeInput: { flex: 1 },

  // Visibility toggle card
  visibilityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  visibilityIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  visibilityLeft: { flex: 1, gap: 3 },
  visibilityLabel: {
    fontFamily: font.bold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  visibilityHint: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },

  // Interest chips
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E8ECF0",
  },
  interestChipSelected: {
    backgroundColor: "#DFF7F6",
    borderColor: "#006A69",
  },
  interestChipText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  interestChipTextSelected: {
    fontFamily: font.bold,
    color: "#006A69",
  },

  // Budget cards
  budgetList: { gap: 10 },
  budgetCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8ECF0",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  budgetCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#F0FEFE",
  },
  budgetCardPressed: { opacity: 0.82 },
  budgetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  budgetIconCircleSelected: {
    backgroundColor: theme.colors.primary,
  },
  budgetCardBody: { flex: 1, gap: 2 },
  budgetCardLabel: {
    fontFamily: font.bold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  budgetCardLabelSelected: { color: "#006A69" },
  budgetCardSub: {
    fontFamily: font.semiBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  budgetCardDesc: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },
  budgetCardCheckSlot: { width: 24, alignItems: "center" },
  budgetCardCheck: {},
  budgetCardCheckHidden: { opacity: 0 },

  // Error row
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#9A3412",
  },

  // CTAs
  ctaGroup: { gap: 10, marginTop: 4 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    height: 54,
  },
  saveBtnText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    height: 50,
    borderWidth: 1,
    borderColor: "#E8ECF0",
  },
  cancelBtnText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: theme.colors.primaryDark,
  },
  btnDimmed: { opacity: 0.5 },

  // Primary button (error screen)
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
  primaryBtnText: { fontFamily: font.bold, fontSize: 14, color: "#FFFFFF" },
});
