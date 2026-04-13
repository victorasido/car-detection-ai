import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";

import { theme } from "../theme";

export default function PrimaryButton({ label, onPress, disabled, tone = "accent" }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        tone === "accent" ? styles.accent : styles.dark,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  accent: {
    backgroundColor: theme.accent,
  },
  dark: {
    backgroundColor: theme.surfaceStrong,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  label: {
    color: theme.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
