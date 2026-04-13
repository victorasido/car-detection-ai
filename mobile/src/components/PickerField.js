import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { theme } from "../theme";

export default function PickerField({ label, hint, type, value, onChange }) {
  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    onChange(result.assets[0]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={handlePick} style={styles.field}>
        <Text style={styles.value} numberOfLines={1}>
          {value ? value.name : hint}
        </Text>
        <Text style={styles.action}>{value ? "Replace" : "Select"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    color: theme.ink,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  field: {
    backgroundColor: theme.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.line,
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  value: {
    flex: 1,
    color: theme.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});
