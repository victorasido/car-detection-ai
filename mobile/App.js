import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import PrimaryButton from "./src/components/PrimaryButton";
import PickerField from "./src/components/PickerField";
import SectionCard from "./src/components/SectionCard";
import { analyzeVehicle, API_BASE, compareVehicles, valuateVehicle } from "./src/lib/api";
import { clearHistory, loadHistory, saveHistoryItem } from "./src/lib/history";
import { theme } from "./src/theme";

const TABS = ["damage", "value", "compare", "history", "account"];

export default function App() {
  const [activeTab, setActiveTab] = useState("damage");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  const [damageFile, setDamageFile] = useState(null);
  const [damageResult, setDamageResult] = useState(null);

  const [valueFile, setValueFile] = useState(null);
  const [valueResult, setValueResult] = useState(null);
  const [referencePrice, setReferencePrice] = useState("");
  const [manufactureYear, setManufactureYear] = useState("");
  const [mileageKm, setMileageKm] = useState("");
  const [currency, setCurrency] = useState("IDR");

  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [compareResult, setCompareResult] = useState(null);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  const runAction = async (kind, action) => {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (kind === "damage") setDamageResult(result);
      if (kind === "value") setValueResult(result);
      if (kind === "compare") setCompareResult(result);
      const updated = await saveHistoryItem(kind, result);
      setHistory(updated);
      setActiveTab(kind);
    } catch (nextError) {
      setError(nextError.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClearHistory = async () => {
    const cleared = await clearHistory();
    setHistory(cleared);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Vehicle Inspect Mobile</Text>
          <Text style={styles.title}>Phase 4 mobile shell for inspection, pricing, and field ops.</Text>
          <Text style={styles.subtitle}>
            Backend target: {API_BASE}. Damage, value, compare, and history are wired to the APIs you already have.
          </Text>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {activeTab === "damage" ? (
          <SectionCard
            title="Damage Scan"
            subtitle="Pick a photo or a video, send it to /analyze, and keep the result in local history."
            accent
          >
            <PickerField
              label="Media"
              hint="JPG, PNG, WEBP, MP4, MOV"
              type={["image/*", "video/*"]}
              value={damageFile}
              onChange={setDamageFile}
            />
            <PrimaryButton
              label={busy ? "Analyzing..." : "Run Damage Analysis"}
              disabled={busy || !damageFile}
              onPress={() => runAction("damage", () => analyzeVehicle(damageFile))}
            />
            {damageResult ? <DamageResult result={damageResult} /> : null}
          </SectionCard>
        ) : null}

        {activeTab === "value" ? (
          <SectionCard
            title="Value Estimator"
            subtitle="Use /valuation as the first mobile pricing flow while the market-aware model is still pending."
          >
            <PickerField
              label="Media"
              hint="JPG, PNG, WEBP, MP4, MOV"
              type={["image/*", "video/*"]}
              value={valueFile}
              onChange={setValueFile}
            />
            <InputField label="Reference Price" value={referencePrice} onChangeText={setReferencePrice} keyboardType="numeric" />
            <InputField label="Manufacture Year" value={manufactureYear} onChangeText={setManufactureYear} keyboardType="numeric" />
            <InputField label="Mileage (KM)" value={mileageKm} onChangeText={setMileageKm} keyboardType="numeric" />
            <InputField label="Currency" value={currency} onChangeText={setCurrency} autoCapitalize="characters" />
            <PrimaryButton
              label={busy ? "Estimating..." : "Estimate Vehicle Value"}
              disabled={busy || !valueFile || !referencePrice}
              onPress={() =>
                runAction("value", () =>
                  valuateVehicle(valueFile, referencePrice, manufactureYear, mileageKm, currency)
                )
              }
            />
            {valueResult ? <ValueResult result={valueResult} /> : null}
          </SectionCard>
        ) : null}

        {activeTab === "compare" ? (
          <SectionCard
            title="Vehicle Compare"
            subtitle="Field operator flow for comparing two vehicle videos from different capture sessions."
          >
            <PickerField label="Video A" hint="Select first vehicle video" type="video/*" value={compareA} onChange={setCompareA} />
            <PickerField label="Video B" hint="Select second vehicle video" type="video/*" value={compareB} onChange={setCompareB} />
            <PrimaryButton
              label={busy ? "Comparing..." : "Compare Vehicles"}
              disabled={busy || !compareA || !compareB}
              onPress={() => runAction("compare", () => compareVehicles(compareA, compareB))}
            />
            {compareResult ? <CompareResult result={compareResult} /> : null}
          </SectionCard>
        ) : null}

        {activeTab === "history" ? (
          <SectionCard
            title="Session History"
            subtitle="Compact local history for field use. This stays on-device until backend auth/profile sync exists."
          >
            <PrimaryButton label="Clear Local History" tone="dark" disabled={busy || history.length === 0} onPress={handleClearHistory} />
            <View style={styles.historyList}>
              {history.length === 0 ? <Text style={styles.emptyText}>No sessions saved yet.</Text> : null}
              {history.map((item) => (
                <View key={`${item.kind}-${item.session_id}-${item.timestamp}`} style={styles.historyCard}>
                  <Text style={styles.historyKind}>{item.kind.toUpperCase()}</Text>
                  <Text style={styles.historyMeta}>{item.session_id || "no-session-id"}</Text>
                  <Text style={styles.historyMeta}>{new Date(item.timestamp).toLocaleString()}</Text>
                  <Text style={styles.historySummary}>{summarizeHistory(item)}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {activeTab === "account" ? (
          <SectionCard
            title="Account and Auth"
            subtitle="This screen is intentionally a Phase 4 placeholder. Mobile auth UX can start here once backend auth endpoints exist."
          >
            <View style={styles.accountBox}>
              <Text style={styles.accountLine}>Status: auth backend not implemented yet.</Text>
              <Text style={styles.accountLine}>Planned: sign in, report sync, dealership roles, cloud history.</Text>
              <Text style={styles.accountLine}>Current mobile scaffold is ready to consume those APIs later.</Text>
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InputField(props) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.inputLabel}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.inkSoft}
        style={styles.input}
      />
    </View>
  );
}

function DamageResult({ result }) {
  return (
    <View style={styles.resultBox}>
      <ResultLine label="Condition" value={`${result.overall_condition} (${result.condition_score}/10)`} />
      <ResultLine label="Urgency" value={result.repair_urgency} />
      <ResultLine label="Damage Count" value={String(result.estimated_damage_count)} />
      <Text style={styles.resultNote}>{result.analysis_notes}</Text>
    </View>
  );
}

function ValueResult({ result }) {
  return (
    <View style={styles.resultBox}>
      <ResultLine label="Estimate" value={`${result.currency} ${formatMoney(result.estimated_value)}`} />
      <ResultLine
        label="Range"
        value={`${formatMoney(result.estimated_value_min)} - ${formatMoney(result.estimated_value_max)}`}
      />
      <ResultLine label="Confidence" value={result.pricing_confidence} />
      <Text style={styles.resultNote}>{result.pricing_notes}</Text>
    </View>
  );
}

function CompareResult({ result }) {
  return (
    <View style={styles.resultBox}>
      <ResultLine label="Similarity" value={`${Number(result.similarity_percentage).toFixed(1)}%`} />
      <ResultLine label="Verdict" value={result.verdict} />
      <ResultLine label="Confidence" value={result.confidence} />
      <Text style={styles.resultNote}>{result.explanation}</Text>
    </View>
  );
}

function ResultLine({ label, value }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

function summarizeHistory(item) {
  if (item.kind === "compare") {
    return `${item.verdict} at ${Number(item.similarity_percentage || 0).toFixed(1)}%`;
  }
  if (item.kind === "analyze") {
    return `${item.overall_condition} condition, ${item.estimated_damage_count} damage area(s)`;
  }
  return `${item.currency || "IDR"} ${formatMoney(item.estimated_value || 0)} (${item.pricing_confidence || "N/A"})`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scroll: {
    padding: 18,
    gap: 16,
    paddingBottom: 42,
  },
  hero: {
    backgroundColor: theme.surfaceStrong,
    borderRadius: 28,
    padding: 22,
    gap: 10,
  },
  eyebrow: {
    color: "#A6D9C7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: theme.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  subtitle: {
    color: "#D3EFE6",
    fontSize: 14,
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tab: {
    backgroundColor: theme.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: theme.accent,
  },
  tabText: {
    color: theme.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: theme.white,
  },
  errorBox: {
    backgroundColor: "#F7D6CF",
    borderColor: "#D96C4B",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  errorText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: "600",
  },
  fieldWrap: {
    gap: 8,
  },
  inputLabel: {
    color: theme.ink,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: theme.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.line,
    minHeight: 54,
    color: theme.ink,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  resultBox: {
    backgroundColor: "#FCF4E8",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E4D2BD",
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  resultLabel: {
    color: theme.inkSoft,
    fontSize: 13,
  },
  resultValue: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  resultNote: {
    color: theme.ink,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: theme.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.line,
    gap: 5,
  },
  historyKind: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  historyMeta: {
    color: theme.inkSoft,
    fontSize: 12,
  },
  historySummary: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    color: theme.inkSoft,
    fontSize: 13,
  },
  accountBox: {
    backgroundColor: "#EFE7D9",
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  accountLine: {
    color: theme.ink,
    fontSize: 14,
    lineHeight: 20,
  },
});
