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
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0",
  debug: false, // Set to true to print debugging info in development
});


import PrimaryButton from "./src/components/PrimaryButton";
import PickerField from "./src/components/PickerField";
import SectionCard from "./src/components/SectionCard";
import LoginScreen from "./src/screens/LoginScreen";
import { 
  analyzeVehicle, 
  API_BASE, 
  compareVehicles, 
  valuateVehicle, 
  getMe, 
  clearToken,
  inspectVehicle,
  getInspectionStatus,
  getInspectionResult,
} from "./src/lib/api";
import { clearHistory, loadHistory, saveHistoryItem } from "./src/lib/history";
import { theme } from "./src/theme";

const TABS = ["damage", "value", "compare", "history", "account"];

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState("damage");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  // V2 Async Inspection state
  const [damageFile, setDamageFile] = useState(null);
  const [inspectionId, setInspectionId] = useState(null);
  const [inspectionStatus, setInspectionStatus] = useState(null); // pending|processing|done|failed
  const [inspectionProgress, setInspectionProgress] = useState({ frames_analyzed: 0, frames_total: 0 });
  const [damageResult, setDamageResult] = useState(null);
  const pollRef = React.useRef(null);

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
    checkAuth();
    loadHistory().then(setHistory);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await getMe();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  };

  const handleLogout = async () => {
    await clearToken();
    setUser(null);
  };

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
      if (nextError.message.includes("401") || nextError.message.toLowerCase().includes("unauthorized")) {
        setUser(null);
      }
      setError(nextError.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  // ── V2 Inspection Flow ─────────────────────────────────
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const runInspectionV2 = async () => {
    if (!damageFile) return;
    setBusy(true);
    setError("");
    setDamageResult(null);
    setInspectionId(null);
    setInspectionStatus("uploading");
    setInspectionProgress({ frames_analyzed: 0, frames_total: 0 });
    stopPolling();

    try {
      // Step 1: Submit — returns immediately with inspection_id
      const submitted = await inspectVehicle(damageFile);
      if (submitted.offlineSaved) {
        setInspectionStatus("offline");
        setBusy(false);
        return;
      }
      const id = submitted.inspection_id;
      setInspectionId(id);
      setInspectionStatus("pending");

      // Step 2: Poll every 3s until done | failed
      pollRef.current = setInterval(async () => {
        try {
          const statusData = await getInspectionStatus(id);
          const st = statusData.status;
          setInspectionStatus(st);
          setInspectionProgress(statusData.progress || { frames_analyzed: 0, frames_total: 0 });

          if (st === "done") {
            stopPolling();
            // Step 3: Fetch full result
            const result = await getInspectionResult(id);
            setDamageResult(result);
            const updated = await saveHistoryItem("damage", result);
            setHistory(updated);
            setBusy(false);
          } else if (st === "failed") {
            stopPolling();
            setError(statusData.error_message || "Inspection failed on server.");
            setBusy(false);
          }
        } catch (pollErr) {
          stopPolling();
          setError(pollErr.message || "Polling error");
          setBusy(false);
        }
      }, 3000);

    } catch (err) {
      if (err.message?.includes("401") || err.message?.toLowerCase().includes("unauthorized")) {
        setUser(null);
      }
      setError(err.message || "Upload failed");
      setInspectionStatus(null);
      setBusy(false);
    }
  };
  // ─────────────────────────────────────────────────────────

  const handleClearHistory = async () => {
    const cleared = await clearHistory();
    setHistory(cleared);
  };

  if (!authChecked) {
    return (
      <View style={[styles.safe, styles.center]}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={checkAuth} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Vehicle Inspect Mobile</Text>
          <Text style={styles.title}>Welcome, {user.username}</Text>
          <Text style={styles.subtitle}>
            Cloud sessions are active. All inspections are saved to your account.
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
            title="Damage Scan (V2)"
            subtitle="Upload video → server extracts frames → AI analyzes each frame → full report."
            accent
          >
            <PickerField
              label="Video / Photo"
              hint="MP4, MOV, MKV, JPG, PNG"
              type={["image/*", "video/*"]}
              value={damageFile}
              onChange={(f) => { setDamageFile(f); setDamageResult(null); setInspectionStatus(null); }}
            />
            <PrimaryButton
              label={
                busy
                  ? inspectionStatus === "uploading" ? "Uploading..."
                  : inspectionStatus === "pending"   ? "Waiting in queue..."
                  : inspectionStatus === "processing" ? "Analyzing frames..."
                  : "Processing..."
                  : "Run Inspection"
              }
              disabled={busy || !damageFile}
              onPress={runInspectionV2}
            />

            {/* Progress Bar */}
            {busy && inspectionStatus && inspectionStatus !== "uploading" ? (
              <InspectionProgress status={inspectionStatus} progress={inspectionProgress} />
            ) : null}

            {/* Offline saved badge */}
            {inspectionStatus === "offline" ? (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineText}>📶 Saved offline — will sync when back online.</Text>
              </View>
            ) : null}

            {damageResult ? <InspectionResult result={damageResult} /> : null}
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
            title="Account Settings"
            subtitle="Your current profile and app session."
          >
            <View style={styles.accountBox}>
              <Text style={styles.accountLine}>User ID: {user.user_id}</Text>
              <Text style={styles.accountLine}>Username: {user.username}</Text>
              <Text style={styles.accountLine}>Backend: {API_BASE}</Text>
            </View>
            <PrimaryButton label="Sign Out" tone="dark" onPress={handleLogout} />
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

// ── V2 Inspection Components ───────────────────────────────────

const STATUS_LABELS = {
  pending:    "⏳ Waiting in queue...",
  processing: "🔍 Analyzing frames...",
  done:       "✅ Done!",
  failed:     "❌ Failed",
};

const URGENCY_COLOR = {
  none:        "#2E7D32",
  optional:    "#558B2F",
  recommended: "#F57F17",
  urgent:      "#E65100",
  critical:    "#B71C1C",
};

const CONDITION_COLOR = {
  excellent: "#1B5E20",
  good:      "#388E3C",
  fair:      "#F9A825",
  poor:      "#E64A19",
  critical:  "#B71C1C",
  unknown:   "#757575",
};

function InspectionProgress({ status, progress }) {
  const analyzed = progress?.frames_analyzed ?? 0;
  const total    = progress?.frames_total    ?? 0;
  const pct      = total > 0 ? Math.min(analyzed / total, 1) : 0;

  return (
    <View style={styles.progressCard}>
      <Text style={styles.progressLabel}>{STATUS_LABELS[status] ?? status}</Text>
      {total > 0 ? (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
          </View>
          <Text style={styles.progressCount}>{analyzed} / {total} frames</Text>
        </>
      ) : (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "40%", opacity: 0.6 }]} />
        </View>
      )}
    </View>
  );
}

function InspectionResult({ result }) {
  const condColor   = CONDITION_COLOR[result.overall_condition] ?? "#333";
  const urgColor    = URGENCY_COLOR[result.repair_urgency]      ?? "#333";
  const damages     = result.damages ?? [];
  const frames      = result.frames  ?? [];

  return (
    <View style={styles.inspResultBox}>
      {/* Header */}
      <View style={styles.inspHeaderRow}>
        <View style={[styles.condBadge, { backgroundColor: condColor }]}>
          <Text style={styles.condBadgeText}>{(result.overall_condition ?? "?").toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <ResultLine label="Score"   value={`${result.condition_score ?? "?"} / 10`} />
          <ResultLine label="Urgency" value={
            <Text style={{ color: urgColor, fontWeight: "700" }}>{result.repair_urgency ?? "?"}</Text>
          } />
          <ResultLine label="Frames"  value={`${frames.length} analyzed`} />
        </View>
      </View>

      <Text style={styles.inspNotes}>{result.analysis_notes}</Text>

      {/* Damage list */}
      {damages.length > 0 ? (
        <View style={styles.damageList}>
          <Text style={styles.damageSectionLabel}>DETECTED DAMAGES ({damages.length})</Text>
          {damages.map((d, i) => (
            <View key={i} style={styles.damageItem}>
              <View style={styles.damageItemHeader}>
                <Text style={styles.damageType}>{d.type?.replace("_", " ").toUpperCase()}</Text>
                <Text style={[styles.damageSev, { color: d.severity === "severe" ? "#B71C1C" : d.severity === "moderate" ? "#E65100" : "#388E3C" }]}>
                  {d.severity}
                </Text>
              </View>
              <Text style={styles.damageLoc}>{d.location}</Text>
              {d.description ? <Text style={styles.damageDesc}>{d.description}</Text> : null}
              {d.occurrence_count > 1 ? (
                <Text style={styles.damageOcc}>Seen in {d.occurrence_count} frames</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.inspNotes}>✅ No damage detected across all frames.</Text>
      )}
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
// ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
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
    marginBottom: 16,
  },
  accountLine: {
    color: theme.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  // ── V2 Inspection styles ──────────────────────────────────
  offlineBadge: {
    backgroundColor: "#FFF8E1",
    borderColor: "#F9A825",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  offlineText: {
    color: "#F57F17",
    fontSize: 13,
    fontWeight: "600",
  },
  progressCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#A5D6A7",
  },
  progressLabel: {
    color: "#1B5E20",
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#C8E6C9",
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: "#43A047",
    borderRadius: 99,
  },
  progressCount: {
    color: "#388E3C",
    fontSize: 12,
    textAlign: "right",
  },
  inspResultBox: {
    backgroundColor: "#F8F8F8",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  inspHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  condBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  condBadgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },
  inspNotes: {
    color: "#555",
    fontSize: 13,
    lineHeight: 19,
  },
  damageList: {
    gap: 8,
  },
  damageSectionLabel: {
    color: "#B71C1C",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  damageItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    gap: 4,
  },
  damageItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  damageType: {
    fontSize: 12,
    fontWeight: "800",
    color: "#333",
    letterSpacing: 0.5,
  },
  damageSev: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  damageLoc: {
    fontSize: 12,
    color: "#888",
    textTransform: "lowercase",
  },
  damageDesc: {
    fontSize: 12,
    color: "#555",
    lineHeight: 17,
  },
  damageOcc: {
    fontSize: 11,
    color: "#9E9E9E",
    fontStyle: "italic",
  },
});

export default Sentry.wrap(App);
