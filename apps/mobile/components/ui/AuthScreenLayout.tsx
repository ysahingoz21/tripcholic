import { ReactNode } from "react";
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { font } from "@/constants/typography";
import { theme } from "@/constants/theme";

type Props = {
  tagline: string;
  children: ReactNode;
};

export default function AuthScreenLayout({ tagline, children }: Props) {
  return (
    <ImageBackground
      source={require("../../assets/images/login-bg.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <SafeAreaView
        style={styles.safe}
        edges={["top", "bottom", "left", "right"]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Brand header */}
            <View style={styles.brand}>
              <Image
                source={require("../../assets/images/logos/logo-without-text.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.wordmark}>Tripcholic</Text>
              <Text style={styles.tagline}>{tagline}</Text>
            </View>

            {/* Form card */}
            <View style={styles.card}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 36, 48, 0.5)",
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  brand: {
    alignItems: "center",
    marginBottom: 12,
  },
  logo: {
    width: 108,
    height: 108,
    marginBottom: 0,
  },
  wordmark: {
    fontFamily: font.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  tagline: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: 24,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
