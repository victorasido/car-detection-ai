import React from "react";
import { View, Text, StyleSheet } from "react-native";

import { theme } from "../theme";

export default function SectionCard({ title, subtitle, children, accent = false }) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.title, accent && styles.titleAccent]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, accent && styles.subtitleAccent]}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  cardAccent: {
    backgroundColor: theme.surfaceStrong,
    borderColor: "#245B51",
  },
  title: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  titleAccent: {
    color: theme.white,
  },
  subtitle: {
    color: theme.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  subtitleAccent: {
    color: "#C9E5DA",
  },
  body: {
    gap: 12,
    marginTop: 8,
  },
});
