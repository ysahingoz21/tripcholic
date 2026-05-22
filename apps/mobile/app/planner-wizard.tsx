import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import CategoryCard from "@/components/ui/CategoryCard";
import { theme } from "@/constants/theme";
import { font, type } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { createTrip, optimizeTrip } from "@/services/trips";
import {
  buildTripPayloadFromPlannerState,
  type PlannerBudgetStyle,
} from "@/utils/tripPlanningPayload";

// ── Constants ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 3;

type CategoryDef = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholderBg: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    id: "culture",
    label: "Culture",
    icon: "library-outline",
    placeholderBg: "#DFF7F6",
  },
  {
    id: "food",
    label: "Food",
    icon: "restaurant-outline",
    placeholderBg: "#FFF7E8",
  },
  {
    id: "museums",
    label: "Museums",
    icon: "business-outline",
    placeholderBg: "#EEF2FF",
  },
  {
    id: "history",
    label: "History",
    icon: "hourglass-outline",
    placeholderBg: "#F5F0FF",
  },
  {
    id: "nature",
    label: "Nature",
    icon: "leaf-outline",
    placeholderBg: "#ECFDF5",
  },
  {
    id: "nightlife",
    label: "Nightlife",
    icon: "moon-outline",
    placeholderBg: "#1E2940",
  },
  {
    id: "shopping",
    label: "Shopping",
    icon: "bag-handle-outline",
    placeholderBg: "#FEF3C7",
  },
  {
    id: "coffee",
    label: "Coffee",
    icon: "cafe-outline",
    placeholderBg: "#F5E6D3",
  },
];

const CATEGORY_IMAGES: Partial<Record<string, number>> = {
  culture: require("@/assets/images/planner/categories/categories-culture.png"),
  food: require("@/assets/images/planner/categories/categories-food.png"),
  museums: require("@/assets/images/planner/categories/categories-museums.png"),
  history: require("@/assets/images/planner/categories/categories-history.png"),
  nature: require("@/assets/images/planner/categories/categories-nature.png"),
  nightlife: require("@/assets/images/planner/categories/categories-nightlife.png"),
  shopping: require("@/assets/images/planner/categories/categories-shopping.png"),
  coffee: require("@/assets/images/planner/categories/categories-coffee.png"),
};

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

// ── Screen ─────────────────────────────────────────────────────────────────

export default function PlannerWizardScreen() {
  const router = useRouter();
  const { token, isLoading: isAuthLoading, user } = useAuth();

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — When
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [availableTime, setAvailableTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Step 2 — Interests
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "culture",
    "food",
  ]);

  // Step 3 — Budget
  const [budgetStyle, setBudgetStyle] = useState<PlannerBudgetStyle>("");

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Avatar initials ───────────────────────────────────────────────────────

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "T");

  // ── Time helpers (preserved) ──────────────────────────────────────────────

  const formatDateForApi = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isPastTripDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) && value < formatDateForApi(new Date());

  const minimumTripDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const formatTimeForApi = (value: Date) => {
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getStartTimeValue = () => {
    const match = availableTime.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const value = match ? match[1] : "10:00";
    const [hours, minutes] = value.split(":").map(Number);
    const base = new Date();
    base.setHours(hours, minutes, 0, 0);
    return base;
  };

  const getEndTimeValue = () => {
    const match = availableTime.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const value = match ? match[2] : "18:00";
    const [hours, minutes] = value.split(":").map(Number);
    const base = new Date();
    base.setHours(hours, minutes, 0, 0);
    return base;
  };

  const updateStartTime = (selected: Date) => {
    const newStart = formatTimeForApi(selected);
    const match = availableTime.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const currentEnd = match ? match[2] : "18:00";
    setAvailableTime(`${newStart}-${currentEnd}`);
  };

  const updateEndTime = (selected: Date) => {
    const newEnd = formatTimeForApi(selected);
    const match = availableTime.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    const currentStart = match ? match[1] : "10:00";
    setAvailableTime(`${currentStart}-${newEnd}`);
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleBack = () => {
    if (step === 1) router.back();
    else if (step === 2) setStep(1);
    else setStep(2);
  };

  const handleContinue = () => {
    if (step === 1) {
      const missing: string[] = [];
      if (!title.trim()) missing.push("Trip title");
      if (!destination.trim()) missing.push("Destination");
      if (!date.trim()) missing.push("Date");

      if (missing.length > 0) {
        Alert.alert(
          "Missing required fields",
          `Please fill in: ${missing.join(", ")}`,
        );
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        Alert.alert("Invalid date", "Please select a date from the calendar.");
        return;
      }
      if (isPastTripDate(date.trim())) {
        Alert.alert("Invalid date", "Please select today or a future date.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  // ── Submit (preserved logic) ──────────────────────────────────────────────

  const handleGenerateRoute = async () => {
    if (!token) {
      Alert.alert(
        "Authentication required",
        isAuthLoading
          ? "Restoring session. Please try again in a moment."
          : "Please sign in again.",
      );
      return;
    }

    if (!title.trim() || !destination.trim() || !date.trim()) {
      Alert.alert(
        "Missing required fields",
        "Trip title, destination and date are required.",
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert(
        "Invalid date",
        "Please use the date picker to select a valid date.",
      );
      return;
    }
    if (isPastTripDate(date.trim())) {
      Alert.alert("Invalid date", "Please select today or a future date.");
      return;
    }

    if (isSubmitting) return;

    const payload = buildTripPayloadFromPlannerState({
      title,
      destination,
      date,
      availableTime,
      categories: selectedCategories,
      budgetStyle,
    });

    try {
      setIsSubmitting(true);
      const createdTrip = await createTrip(token, payload);
      const optimizedTrip = await optimizeTrip(token, createdTrip.trip.id);

      router.push({
        pathname: "/results",
        params: { tripId: optimizedTrip.trip.id },
      });
    } catch (error) {
      Alert.alert(
        "Unable to generate route",
        error instanceof Error
          ? error.message
          : "Trip creation or optimization failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Progress ─────────────────────────────────────────────────────────────

  const progressPct = Math.round((step / TOTAL_STEPS) * 100);

  // ── Step 1: When ─────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepEyebrow}>Step 1 — Where & when</Text>
      <Text style={styles.stepTitle}>{"Where are you\nheading?"}</Text>
      <Text style={styles.stepSubtitle}>
        Name your trip, pick the area you will explore, and tell us your day.
        We will build the route from there.
      </Text>

      {/* Trip title */}
      <Text style={styles.fieldLabel}>Trip title *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="e.g. Weekend in Old Istanbul"
        placeholderTextColor="#A0ADB4"
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
        autoCorrect={false}
        maxLength={120}
      />
      <Text style={styles.fieldHint}>
        Give your trip a name. You will see it in your saved trips list.
      </Text>

      {/* Destination */}
      <Text style={styles.fieldLabel}>Destination *</Text>
      <TextInput
        style={styles.textInput}
        placeholder="e.g. Kadıköy, Beşiktaş, Sultanahmet"
        placeholderTextColor="#A0ADB4"
        value={destination}
        onChangeText={setDestination}
        returnKeyType="done"
        autoCorrect={false}
      />
      <Text style={styles.fieldHint}>
        We will recommend places within ~10 km of your destination. Popular:
        Kadıköy · Beşiktaş · Taksim · Sultanahmet · Balat
      </Text>

      {/* Date */}
      <Text style={styles.fieldLabel}>Date *</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowDatePicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="calendar-outline"
          size={17}
          color={date ? theme.colors.primaryDark : "#A0ADB4"}
          style={styles.pickerIcon}
        />
        <Text
          style={[styles.pickerText, !date && styles.pickerTextPlaceholder]}
        >
          {date || "Select a date"}
        </Text>
      </TouchableOpacity>
      <Text style={styles.fieldHint}>Tap to open the calendar</Text>

      {showDatePicker && (
        <DateTimePicker
          value={date ? new Date(`${date}T12:00:00`) : new Date()}
          mode="date"
          display="default"
          minimumDate={minimumTripDate()}
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(formatDateForApi(selectedDate));
          }}
        />
      )}

      {/* Time range */}
      <Text style={styles.fieldLabel}>Available time</Text>
      <View style={styles.timeRow}>
        <TouchableOpacity
          style={[styles.pickerButton, styles.timePickerButton]}
          onPress={() => setShowStartTimePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="time-outline"
            size={17}
            color={availableTime ? theme.colors.primaryDark : "#A0ADB4"}
            style={styles.pickerIcon}
          />
          <Text
            style={[
              styles.pickerText,
              !availableTime && styles.pickerTextPlaceholder,
            ]}
          >
            {availableTime ? availableTime.split("-")[0] : "Start"}
          </Text>
        </TouchableOpacity>

        <View style={styles.timeDivider} />

        <TouchableOpacity
          style={[styles.pickerButton, styles.timePickerButton]}
          onPress={() => setShowEndTimePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="time-outline"
            size={17}
            color={availableTime ? theme.colors.primaryDark : "#A0ADB4"}
            style={styles.pickerIcon}
          />
          <Text
            style={[
              styles.pickerText,
              !availableTime && styles.pickerTextPlaceholder,
            ]}
          >
            {availableTime ? availableTime.split("-")[1] : "End"}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.fieldHint}>
        Most sites in Istanbul close between 17:00 – 19:00.
      </Text>

      {showStartTimePicker && (
        <DateTimePicker
          value={getStartTimeValue()}
          mode="time"
          display="default"
          onChange={(_, selectedTime) => {
            setShowStartTimePicker(false);
            if (selectedTime) updateStartTime(selectedTime);
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={getEndTimeValue()}
          mode="time"
          display="default"
          onChange={(_, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) updateEndTime(selectedTime);
          }}
        />
      )}
    </View>
  );

  // ── Step 2: Interests ─────────────────────────────────────────────────────

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepEyebrow}>Step 2 — Interests</Text>
      <Text style={styles.stepTitle}>{"What are you\ninto?"}</Text>
      <Text style={styles.stepSubtitle}>
        Pick as many as you like. We will tailor your itinerary to match your
        style.
      </Text>

      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat, index) => {
          if (index % 2 !== 0) return null;
          const right = CATEGORIES[index + 1];
          return (
            <View key={cat.id} style={styles.categoryRow}>
              <CategoryCard
                label={cat.label}
                icon={cat.icon}
                localImage={CATEGORY_IMAGES[cat.id]}
                placeholderBg={cat.placeholderBg}
                selected={selectedCategories.includes(cat.id)}
                onPress={() => toggleCategory(cat.id)}
              />
              {right ? (
                <CategoryCard
                  label={right.label}
                  icon={right.icon}
                  localImage={CATEGORY_IMAGES[right.id]}
                  placeholderBg={right.placeholderBg}
                  selected={selectedCategories.includes(right.id)}
                  onPress={() => toggleCategory(right.id)}
                />
              ) : (
                <View style={styles.categoryPlaceholder} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  // ── Step 3: Budget ────────────────────────────────────────────────────────

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepEyebrow}>Step 3 — Budget</Text>
      <Text style={styles.stepTitle}>{"What is your\nbudget style?"}</Text>
      <Text style={styles.stepSubtitle}>
        We will prioritise stops and experiences that match your spending comfort.
        You can skip this if you prefer.
      </Text>

      <View style={styles.budgetList}>
        {BUDGET_OPTIONS.map(({ key, label, sub, icon, desc }) => {
          const isSelected = budgetStyle === key;
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.budgetCard,
                isSelected && styles.budgetCardSelected,
                pressed && styles.budgetCardPressed,
              ]}
              onPress={() => {
                setBudgetStyle(isSelected ? "" : key);
              }}
            >
              {/* Icon circle */}
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

              {/* Text block */}
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

              {/* Check — always rendered so layout width never shifts */}
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
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.flex}>
          {/* ── Wizard header — non-scrolling ── */}
          <View style={styles.wizardHeader}>
            <View style={styles.headerInner}>
              {/* Left: back button */}
              <View style={styles.headerSide}>
                <Pressable
                  onPress={handleBack}
                  style={styles.backBtn}
                  hitSlop={8}
                >
                  <Ionicons
                    name="arrow-back"
                    size={20}
                    color={theme.colors.primaryDark}
                  />
                </Pressable>
              </View>

              {/* Center: wordmark */}
              <Text style={styles.headerWordmark} numberOfLines={1}>
                TRIPCHOLIC
              </Text>

              {/* Right: avatar → Profile */}
              <View style={[styles.headerSide, styles.headerSideRight]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.avatar,
                    pressed && styles.avatarPressed,
                  ]}
                  onPress={() => router.push("/(tabs)/profile")}
                  hitSlop={8}
                >
                  <Text style={styles.avatarText}>{initials}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* ── Progress — non-scrolling ── */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progressPct}%` }]}
              />
            </View>
            <Text style={styles.progressLabel}>{progressPct}% complete</Text>
          </View>

          {/* ── Scrollable step content ── */}
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </ScrollView>

          {/* ── Bottom CTA — moves above keyboard on iOS, stable elsewhere ── */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <SafeAreaView edges={["bottom"]} style={styles.ctaWrap}>
              <Pressable
                style={({ pressed }) => [
                  styles.ctaButton,
                  step === 3 &&
                    (isSubmitting || isAuthLoading) &&
                    styles.ctaButtonDisabled,
                  pressed && styles.ctaButtonPressed,
                ]}
                onPress={step < 3 ? handleContinue : handleGenerateRoute}
                disabled={step === 3 && (isSubmitting || isAuthLoading)}
              >
                {step === 3 && isSubmitting ? (
                  <>
                    <ActivityIndicator
                      color="#FFFFFF"
                      size="small"
                      style={styles.ctaSpinner}
                    />
                    <Text style={styles.ctaButtonText}>Generating route…</Text>
                  </>
                ) : step === 3 ? (
                  <>
                    <Ionicons
                      name="flash"
                      size={16}
                      color="#FFFFFF"
                      style={styles.ctaButtonIcon}
                    />
                    <Text style={styles.ctaButtonText}>Generate Route</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.ctaButtonText}>Continue</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color="#FFFFFF"
                      style={styles.ctaButtonIcon}
                    />
                  </>
                )}
              </Pressable>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // ── Wizard header ──
  wizardHeader: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerInner: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerWordmark: {
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
  avatarPressed: {
    opacity: 0.75,
  },
  avatarText: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    color: "#FFFFFF",
  },

  // ── Progress ──
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 6,
    backgroundColor: theme.colors.background,
  },
  progressTrack: {
    height: 3,
    borderRadius: 99,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 99,
    backgroundColor: "#006A69",
  },
  progressLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },

  // ── Step content ──
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  stepEyebrow: {
    ...type.labelCaps,
    fontSize: 11,
    color: theme.colors.primary,
    marginBottom: 10,
  },
  stepTitle: {
    fontFamily: font.bold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: theme.colors.primaryDark,
    marginBottom: 10,
  },
  stepSubtitle: {
    ...type.bodySm,
    color: theme.colors.textSecondary,
    marginBottom: 28,
  },

  // ── Fields ──
  fieldLabel: {
    fontFamily: font.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primaryDark,
    marginBottom: 8,
    marginTop: 4,
  },
  fieldHint: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 18,
  },
  textInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.primaryDark,
    marginBottom: 4,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 4,
  },
  pickerIcon: {
    marginRight: 10,
  },
  pickerText: {
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.colors.primaryDark,
    flex: 1,
  },
  pickerTextPlaceholder: {
    color: "#A0ADB4",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  timePickerButton: {
    flex: 1,
    marginBottom: 0,
  },
  timeDivider: {
    width: 10,
    height: 1.5,
    backgroundColor: theme.colors.border,
  },

  // ── Category grid ──
  categoryGrid: {
    gap: 12,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 12,
  },
  categoryPlaceholder: {
    flex: 1,
  },

  // ── Budget list ──
  budgetList: {
    gap: 12,
    marginBottom: 8,
  },
  budgetCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 14,
  },
  budgetCardSelected: {
    borderColor: "#006A69",
    borderWidth: 1.5,
  },
  budgetCardPressed: {
    opacity: 0.88,
  },
  budgetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  budgetIconCircleSelected: {
    backgroundColor: "#006A69",
  },
  budgetCardBody: {
    flex: 1,
    gap: 2,
  },
  budgetCardLabel: {
    fontFamily: font.bold,
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.primaryDark,
  },
  budgetCardLabelSelected: {
    color: "#006A69",
  },
  budgetCardSub: {
    fontFamily: font.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  budgetCardDesc: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  budgetCardCheck: {
    flexShrink: 0,
  },
  budgetCardCheckHidden: {
    opacity: 0,
  },
  budgetCardCheckSlot: {
    width: 22,
    minHeight: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  // ── Bottom CTA ──
  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 4,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006A69",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonPressed: {
    opacity: 0.9,
  },
  ctaButtonText: {
    fontFamily: font.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  ctaButtonIcon: {
    // gap on ctaButton handles spacing
  },
  ctaSpinner: {
    // gap on ctaButton handles spacing
  },
});
