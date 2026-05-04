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
        <Ionicons name={icon} size={18} color="#71787C" />
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#A0ADB4"
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
            color="#71787C"
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
    borderColor: '#D4D9DC',
    borderRadius: 12,
    backgroundColor: '#F7FAFC',
    marginBottom: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  iconWrap: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#181C1E',
    paddingVertical: 14,
  },
  eyeWrap: {
    marginLeft: 8,
    padding: 2,
  },
});
