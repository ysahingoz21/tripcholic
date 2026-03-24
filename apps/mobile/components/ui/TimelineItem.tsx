import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

type Props = {
  time: string;
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export default function TimelineItem({
  time,
  title,
  subtitle,
  icon = 'location',
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.timeBlock}>
        <Text style={styles.time}>{time}</Text>
      </View>

      <View style={styles.lineArea}>
        <View style={styles.dot}>
          <Ionicons name={icon} size={14} color={theme.colors.white} />
        </View>
        <View style={styles.line} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timeBlock: {
    width: 64,
    paddingTop: 8,
  },
  time: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  lineArea: {
    width: 32,
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginTop: 2,
    minHeight: 70,
  },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
});