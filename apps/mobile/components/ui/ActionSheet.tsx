import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { font } from '@/constants/typography';

export type ActionSheetOption = {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  cancel?: boolean;
};

type Props = {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
};

export default function ActionSheet({ visible, title, options, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const handleOption = (option: ActionSheetOption) => {
    onClose();
    if (option.onPress) {
      // Defer so the modal has time to close before navigating
      setTimeout(option.onPress, 50);
    }
  };

  const cancelOption = options.find((o) => o.cancel);
  const actionOptions = options.filter((o) => !o.cancel);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={() => {}}
        >
          {title ? (
            <View style={styles.titleRow}>
              <Text style={styles.title}>{title}</Text>
            </View>
          ) : null}

          <View style={styles.optionGroup}>
            {actionOptions.map((option, idx) => (
              <View key={idx}>
                {idx > 0 && <View style={styles.divider} />}
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => handleOption(option)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      option.destructive && styles.optionTextDestructive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>

          {cancelOption && (
            <Pressable
              style={({ pressed }) => [styles.cancelOption, pressed && styles.optionPressed]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>{cancelOption.label}</Text>
            </Pressable>
          )}
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
  titleRow: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  title: {
    fontFamily: font.semiBold,
    fontSize: 13,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: 20,
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
  cancelText: {
    fontFamily: font.semiBold,
    fontSize: 16,
    color: theme.colors.primaryDark,
  },
});
