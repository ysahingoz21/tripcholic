import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SectionTitle from '@/components/ui/SectionTitle';
import { theme } from '@/constants/theme';

function ExploreCard({
  title,
  subtitle,
  tag,
}: {
  title: string;
  subtitle: string;
  tag: string;
}) {
  return (
    <View style={styles.routeCard}>
      <View style={styles.routeCardTop}>
        <Text style={styles.routeTag}>{tag}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color={theme.colors.accent} />
          <Text style={styles.ratingText}>4.8</Text>
        </View>
      </View>

      <Text style={styles.routeTitle}>{title}</Text>
      <Text style={styles.routeSubtitle}>{subtitle}</Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.metaText}>6 hours</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="copy-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.metaText}>Duplicate</Text>
        </View>
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionTitle
          title="Explore Community Routes"
          subtitle="Discover public itineraries, duplicate plans, and get inspired by other travelers."
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          <ExploreCard
            title="Historic Peninsula in One Day"
            subtitle="Culture-heavy route with iconic stops and manageable travel flow."
            tag="Culture"
          />
          <ExploreCard
            title="Kadıköy Food & Coffee Route"
            subtitle="Relaxed day plan focused on local food, cafés, and compact movement."
            tag="Food"
          />
          <ExploreCard
            title="Rainy-Day Indoor Art Plan"
            subtitle="Museum and gallery route adapted for indoor comfort."
            tag="Indoor"
          />
        </ScrollView>

        <View style={styles.sectionGap}>
          <SectionTitle
            title="Community interactions"
            subtitle="Skeleton for publishing, duplication, rating, and comments."
          />
        </View>

        <View style={styles.featureCard}>
          <Ionicons name="people" size={20} color={theme.colors.primary} />
          <Text style={styles.featureTitle}>Public route sharing</Text>
          <Text style={styles.featureText}>
            Publish itineraries so others can discover and reuse them.
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.primary} />
          <Text style={styles.featureTitle}>Ratings & comments</Text>
          <Text style={styles.featureText}>
            Let users react to shared plans and improve discovery quality.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  horizontalList: {
    paddingRight: 8,
  },
  routeCard: {
    width: 290,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginRight: 14,
  },
  routeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeTag: {
    backgroundColor: '#DFF7F5',
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 14,
    marginBottom: 6,
  },
  routeSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  sectionGap: {
    marginTop: theme.spacing.xl,
  },
  featureCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
});