import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';

const PREVIEW_CHAR_LIMIT = 200;

type Props = {
  description: string;
};

export default function TripDescriptionSection({ description }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const { height: screenHeight } = useWindowDimensions();

  const trimmed = description.trim();
  const isLong = trimmed.length > PREVIEW_CHAR_LIMIT;
  const preview = isLong
    ? trimmed.slice(0, PREVIEW_CHAR_LIMIT).trimEnd() + '…'
    : trimmed;

  return (
    <>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.eyebrow}>ABOUT</Text>
        <Text style={styles.title}>Trip Description</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.body}>{preview}</Text>
        {isLong && (
          <Pressable
            style={({ pressed }) => [styles.readAllBtn, pressed && { opacity: 0.6 }]}
            onPress={() => setModalOpen(true)}
            hitSlop={8}
          >
            <Text style={styles.readAllText}>Read all</Text>
            <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Full description modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable
            style={[styles.sheet, { maxHeight: screenHeight * 0.65 }]}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trip Description</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setModalOpen(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalDivider} />

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalBody}>{trimmed}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Section header
  sectionHeader: {
    gap: 2,
  },
  eyebrow: {
    fontFamily: font.bold,
    fontSize: 10,
    color: theme.colors.primary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },

  // Card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.text,
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
  },
  readAllText: {
    fontFamily: font.semiBold,
    fontSize: 13,
    color: theme.colors.primary,
  },

  // Modal backdrop
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // Modal card
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    position: 'relative',
  },
  modalTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: theme.colors.primaryDark,
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  modalScroll: {
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  modalBody: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 24,
    color: theme.colors.text,
  },
});
