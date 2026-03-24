import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ui/ScreenContainer';
import SectionTitle from '../components/ui/SectionTitle';
import AppButton from '../components/ui/AppButton';
import TimelineItem from '../components/ui/TimelineItem';
import { theme } from '../constants/theme';

export default function ResultsScreen() {
  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionTitle
          title="Your Generated Route"
          subtitle="A single-day itinerary with optimized stop order, estimated durations, and explanation."
        />

        <View style={styles.mapCard}>
          <View style={styles.mapHeader}>
            <Ionicons name="map" size={18} color={theme.colors.primaryDark} />
            <Text style={styles.mapTitle}>Map-Based Route Visualization</Text>
          </View>

          <View style={styles.fakeMap}>
            <View style={[styles.poiPin, { top: 28, left: 46 }]} />
            <View style={[styles.poiPin, { top: 72, left: 138 }]} />
            <View style={[styles.poiPin, { top: 128, left: 228 }]} />
            <View style={[styles.poiPin, { top: 82, left: 306 }]} />
            <View style={styles.routeLineOne} />
            <View style={styles.routeLineTwo} />
            <View style={styles.routeLineThree} />
          </View>

          <Text style={styles.mapCaption}>
            Route map placeholder for POIs, stop order, and travel path.
          </Text>
        </View>

        <SectionTitle
          title="Timeline View"
          subtitle="A time-ordered display of the generated day plan."
        />

        <TimelineItem
          time="10:00"
          title="Galata Tower"
          subtitle="Estimated visit: 45 min • Strong starting point with central access."
          icon="business"
        />
        <TimelineItem
          time="11:15"
          title="Coffee Break"
          subtitle="Estimated visit: 30 min • Planned rest stop before next activity."
          icon="cafe"
        />
        <TimelineItem
          time="12:00"
          title="Pera Museum"
          subtitle="Estimated visit: 60 min • Cultural preference match and indoor-friendly."
          icon="images"
        />
        <TimelineItem
          time="13:30"
          title="Lunch Stop"
          subtitle="Estimated visit: 60 min • Budget-aligned meal suggestion nearby."
          icon="restaurant"
        />

        <SectionTitle
          title="Plan Explanation"
          subtitle="LLM-generated reasoning aligned with route constraints and preferences."
        />

        <View style={styles.explanationCard}>
          <Text style={styles.explanationText}>
            This route prioritizes cultural points of interest, keeps walking effort moderate,
            and balances activity time with travel distance. Indoor stops are grouped around midday
            to preserve flexibility if weather conditions change.
          </Text>
        </View>

        <AppButton title="Publish Route" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginLeft: 8,
  },
  fakeMap: {
    height: 220,
    borderRadius: theme.radius.lg,
    backgroundColor: '#EAF6F5',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 10,
  },
  poiPin: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  routeLineOne: {
    position: 'absolute',
    top: 34,
    left: 58,
    width: 95,
    height: 3,
    backgroundColor: theme.colors.primaryDark,
    transform: [{ rotate: '20deg' }],
  },
  routeLineTwo: {
    position: 'absolute',
    top: 96,
    left: 148,
    width: 102,
    height: 3,
    backgroundColor: theme.colors.primaryDark,
    transform: [{ rotate: '24deg' }],
  },
  routeLineThree: {
    position: 'absolute',
    top: 108,
    left: 238,
    width: 78,
    height: 3,
    backgroundColor: theme.colors.primaryDark,
    transform: [{ rotate: '-22deg' }],
  },
  mapCaption: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  explanationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
  },
});