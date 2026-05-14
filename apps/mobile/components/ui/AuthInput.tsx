import { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  ReturnKeyTypeOptions,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font } from '@/constants/typography';
import { theme } from '@/constants/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
};

export default function AuthInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize,
  returnKeyType,
  onSubmitEditing,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const isSecure = secureTextEntry && !showPassword;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={theme.colors.textSecondary} />
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isSecure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCorrect={false}
        blurOnSubmit={returnKeyType === 'done'}
      />
      {secureTextEntry && (
        <Pressable
          onPress={() => setShowPassword(v => !v)}
          style={styles.eyeWrap}
          hitSlop={8}
        >
          <Ionicons
            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    marginBottom: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  iconWrap: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.primaryDark,
    paddingVertical: 14,
  },
  eyeWrap: {
    marginLeft: 8,
    padding: 2,
  },
});
