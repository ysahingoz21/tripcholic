import { useState, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Artwork from "@/components/ui/Artwork";
import UserAvatar from "@/components/ui/UserAvatar";
import { theme } from "@/constants/theme";
import { font } from "@/constants/typography";
import {
  likePublicTrip,
  unlikePublicTrip,
  savePublicTrip,
  unsavePublicTrip,
} from "@/services/publicTrips";
import { type TripPreview } from "@/services/trips";

type Props = {
  tripId: string;
  title: string;
  categories: string[];
  preview: TripPreview;
  creatorName: string | null;
  creatorAvatarUrl?: string | null;
  dateLabel?: string;
  token: string | null;
  onPress: () => void;
  onCreatorPress?: () => void;
  initialLiked?: boolean;
  initialSaved?: boolean;
  initialLikeCount?: number;
  initialSaveCount?: number;
  initialCommentCount?: number;
  hideDistrictLabel?: boolean;
};

function formatCreator(name: string | null) {
  return name?.trim() || "Tripcholic traveler";
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ExploreTripCard({
  tripId,
  title,
  categories,
  preview,
  creatorName,
  creatorAvatarUrl,
  dateLabel,
  token,
  onPress,
  onCreatorPress,
  initialLiked = false,
  initialSaved = false,
  initialLikeCount = 0,
  initialSaveCount = 0,
  initialCommentCount = 0,
  hideDistrictLabel = false,
}: Props) {
  const imageUrl = preview.imageUrl?.trim() || null;
  const stopCount = preview.stopCount ?? 0;
  const districtLabel = hideDistrictLabel ? undefined : preview.districtLabel;

  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [saveCount, setSaveCount] = useState(initialSaveCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);

  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  useEffect(() => { setSaved(initialSaved); }, [initialSaved]);
  useEffect(() => { setLikeCount(initialLikeCount); }, [initialLikeCount]);
  useEffect(() => { setSaveCount(initialSaveCount); }, [initialSaveCount]);
  useEffect(() => { setCommentCount(initialCommentCount); }, [initialCommentCount]);

  const handleLike = async () => {
    if (!token) {
      onPress();
      return;
    }
    const prev = liked;
    const prevCount = likeCount;
    setLiked(!prev);
    setLikeCount(prev ? prevCount - 1 : prevCount + 1);
    try {
      if (prev) {
        await unlikePublicTrip(tripId, token);
      } else {
        await likePublicTrip(tripId, token);
      }
    } catch {
      setLiked(prev);
      setLikeCount(prevCount);
    }
  };

  const handleSave = async () => {
    if (!token) {
      onPress();
      return;
    }
    const prev = saved;
    const prevCount = saveCount;
    setSaved(!prev);
    setSaveCount(prev ? prevCount - 1 : prevCount + 1);
    try {
      if (prev) {
        await unsavePublicTrip(tripId, token);
      } else {
        await savePublicTrip(tripId, token);
      }
    } catch {
      setSaved(prev);
      setSaveCount(prevCount);
    }
  };

  const categoryLine = Array.from(
    new Set([preview.primaryCategory, ...categories].filter(Boolean)),
  )
    .map((c) => cap(c!))
    .join(", ");

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Full-bleed image */}
      <View style={styles.cardImageWrap}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Artwork kind="trip" variant="cover" label={title} />
        )}
      </View>

      {/* Depth scrim from bottom */}
      <View style={styles.cardScrim} />

      {/* ── Top row: creator block ── */}
      <Pressable
        style={styles.creatorBlock}
        onPress={onCreatorPress}
        disabled={!onCreatorPress}
        hitSlop={4}
      >
        <UserAvatar
          avatarUrl={creatorAvatarUrl}
          displayName={creatorName}
          size={28}
          ringSize={0}
        />
        <Text style={styles.creatorName} numberOfLines={1}>
          {formatCreator(creatorName)}
        </Text>
      </Pressable>

      {/* ── Bottom content panel ── */}
      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {title}
        </Text>

        {/* Date + stops + district */}
        {dateLabel || stopCount > 0 || districtLabel ? (
          <View style={styles.cardMeta}>
            {dateLabel && (
              <>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color="rgba(255,255,255,0.75)"
                />
                <Text style={styles.cardMetaText}>{dateLabel}</Text>
              </>
            )}
            {dateLabel && (stopCount > 0 || districtLabel) && (
              <Text style={styles.cardMetaDot}>·</Text>
            )}
            {stopCount > 0 && (
              <>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color="rgba(255,255,255,0.75)"
                />
                <Text style={styles.cardMetaText}>
                  {stopCount} {stopCount === 1 ? "stop" : "stops"}
                </Text>
              </>
            )}
            {stopCount > 0 && districtLabel && (
              <Text style={styles.cardMetaDot}>·</Text>
            )}
            {districtLabel && (
              <Text style={styles.cardMetaText} numberOfLines={1}>
                {districtLabel}
              </Text>
            )}
          </View>
        ) : null}

        {/* Category line */}
        {categoryLine ? (
          <Text style={styles.cardCategoryLine} numberOfLines={1}>
            {categoryLine}
          </Text>
        ) : null}

        {/* Footer: engagement icons + open button */}
        <View style={styles.cardFooter}>
          <View style={styles.engagementRow}>
            <Pressable
              style={styles.engagementItem}
              onPress={handleLike}
              hitSlop={8}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={19}
                color="#FFFFFF"
              />
              <Text style={styles.engagementCount}>{likeCount}</Text>
            </Pressable>
            <Pressable
              style={styles.engagementItem}
              onPress={onPress}
              hitSlop={8}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
              <Text style={styles.engagementCount}>{commentCount}</Text>
            </Pressable>
            <Pressable
              style={styles.engagementItem}
              onPress={handleSave}
              hitSlop={8}
            >
              <Ionicons
                name={saved ? "bookmark" : "bookmark-outline"}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.engagementCount}>{saveCount}</Text>
            </Pressable>
          </View>

          {/* Open button */}
          <Pressable style={styles.openButton} onPress={onPress}>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 460,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardPressed: {
    opacity: 0.93,
  },

  cardImageWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#DFF7F6",
  },

  cardScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "36%",
    backgroundColor: "rgba(11,36,48,0.62)",
  },

  // Creator block
  creatorBlock: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: 280,
  },
  creatorName: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: "rgba(255,255,255,0.92)",
    flexShrink: 1,
  },

  // ── Bottom content ──
  cardBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 18,
    gap: 6,
  },
  cardTitle: {
    fontFamily: font.bold,
    fontSize: 22,
    lineHeight: 28,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  cardMetaText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  cardMetaDot: {
    fontFamily: font.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  cardCategoryLine: {
    fontFamily: font.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.1,
  },

  // Footer row
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  engagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  engagementCount: {
    fontFamily: font.medium,
    fontSize: 13,
    color: "#FFFFFF",
  },

  // Open trip button
  openButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
});
