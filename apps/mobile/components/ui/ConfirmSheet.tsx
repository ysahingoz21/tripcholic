import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.optionGroup}>
            <Pressable
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={destructive ? '#EF4444' : theme.colors.primary}
                />
              ) : (
                <Text style={[styles.optionText, destructive && styles.optionTextDestructive]}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.cancelOption, pressed && styles.cancelOptionPressed]}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 10,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 17,
    color: theme.colors.primaryDark,
    textAlign: 'center',
  },
  message: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  optionGroup: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  optionPressed: {
    backgroundColor: theme.colors.background,
  },
  optionText: {
    fontFamily: font.medium,
    fontSize: 16,
    color: theme.colors.primaryDark,
  },
  optionTextDestructive: {
    color: '#EF4444',
  },
  cancelOption: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 6,
  },
  cancelOptionPressed: {
    backgroundColor: theme.colors.background,
  },
  cancelText: {
    fontFamily: font.semiBold,
    fontSize: 16,
    color: theme.colors.primaryDark,
  },
});
