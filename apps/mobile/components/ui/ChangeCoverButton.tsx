import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { font } from '@/constants/typography';

type Props = {
  onPress: () => void;
  isUploading?: boolean;
  disabled?: boolean;
};

export default function ChangeCoverButton({
  onPress,
  isUploading = false,
  disabled = false,
}: Props) {
  return (
    <Pressable style={styles.btn} onPress={onPress} disabled={disabled || isUploading}>
      {isUploading ? (
        <>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.label}>Uploading…</Text>
        </>
      ) : (
        <>
          <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
          <Text style={styles.label}>Change Cover</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  label: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
