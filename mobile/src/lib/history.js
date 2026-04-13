import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "vehicle_inspection_history_v1";
const MAX_ITEMS = 20;

export async function loadHistory() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveHistoryItem(kind, payload) {
  const current = await loadHistory();
  const compact = compactPayload(kind, payload);
  const updated = [{ ...compact, kind, timestamp: new Date().toISOString() }, ...current].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearHistory() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  return [];
}

function compactPayload(kind, payload) {
  if (kind === "compare") {
    return {
      session_id: payload.session_id,
      similarity_percentage: payload.similarity_percentage,
      verdict: payload.verdict,
      confidence: payload.confidence,
      processing_time_ms: payload.processing_time_ms,
    };
  }

  if (kind === "analyze") {
    return {
      session_id: payload.session_id,
      overall_condition: payload.overall_condition,
      condition_score: payload.condition_score,
      repair_urgency: payload.repair_urgency,
      estimated_damage_count: payload.estimated_damage_count,
    };
  }

  return {
    session_id: payload.session_id,
    estimated_value: payload.estimated_value,
    estimated_value_min: payload.estimated_value_min,
    estimated_value_max: payload.estimated_value_max,
    currency: payload.currency,
    pricing_confidence: payload.pricing_confidence,
  };
}
