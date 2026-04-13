import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, Alert } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import { theme } from "../theme";
import { login, register } from "../lib/api";

export default function LoginScreen({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setBusy(true);
    try {
      if (isRegister) {
        await register(username, password);
        Alert.alert("Success", "Account created! Please log in.");
        setIsRegister(false);
      } else {
        await login(username, password);
        onLoginSuccess();
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to authenticate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>VEHICLE INSPECT</Text>
        <Text style={styles.title}>{isRegister ? "Create Account" : "Welcome Back"}</Text>
        <Text style={styles.subtitle}>
          {isRegister
            ? "Sign up to start saving inspection history to your account."
            : "Login to access your field inspection sessions."}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="Enter username"
            placeholderTextColor={theme.inkSoft}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter password"
            placeholderTextColor={theme.inkSoft}
          />
        </View>

        <PrimaryButton
          label={busy ? "Loading..." : isRegister ? "Register" : "Sign In"}
          onPress={handleSubmit}
          disabled={busy}
          accent={!isRegister}
        />

        <Text
          style={styles.toggleText}
          onPress={() => setIsRegister(!isRegister)}
        >
          {isRegister
            ? "Already have an account? Sign In"
            : "Don't have an account? Register"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: theme.surfaceStrong,
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  eyebrow: {
    color: "#A6D9C7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: theme.white,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#D3EFE6",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: theme.white,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    color: theme.white,
    height: 54,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  toggleText: {
    color: "#A6D9C7",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
});
