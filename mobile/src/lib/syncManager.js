import { getPendingSyncTasks, removeSyncTask, markSyncTaskFailed } from "./db";
import { uploadWithFileSystem, uploadMultipart } from "./api";
import NetInfo from "@react-native-community/netinfo";

let isSyncing = false;

/**
 * Attempts to process the offline sync queue sequentially.
 * Only runs if currently online and not already syncing.
 */
export async function processSyncQueue() {
  if (isSyncing) {
    return;
  }

  const state = await NetInfo.fetch();
  if (!state.isConnected || state.isInternetReachable === false) {
    return; // Still offline
  }

  isSyncing = true;
  try {
    const tasks = await getPendingSyncTasks();
    if (tasks.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[SyncManager] Found ${tasks.length} pending offline tasks. Starting sync...`);

    for (const task of tasks) {
      // Re-verify network before each large upload
      const currentState = await NetInfo.fetch();
      if (!currentState.isConnected || currentState.isInternetReachable === false) {
        console.log("[SyncManager] Network lost during sync. Pausing.");
        break;
      }

      console.log(`[SyncManager] Processing task ID: ${task.id} (${task.endpoint})`);
      
      try {
        let payload;
        try {
          payload = JSON.parse(task.payload);
        } catch (err) {
          throw new Error("Invalid JSON payload in DB");
        }

        if (payload.type === 'fs') {
          // Used for /analyze and /valuation
          await uploadWithFileSystem(task.endpoint, payload.fileParts, payload.extraFields || {});
        } else if (payload.type === 'multipart') {
          // Used for /compare
          await uploadMultipart(task.endpoint, payload.formFields);
        } else {
          throw new Error(`Unknown payload type: ${payload.type}`);
        }

        // Success! Remove from DB
        await removeSyncTask(task.id);
        console.log(`[SyncManager] Task ${task.id} synced successfully.`);

      } catch (err) {
        console.error(`[SyncManager] Task ${task.id} failed to sync:`, err);
        // We could implement retry logic here. For now, mark as failed if it's a 4xx error (bad data),
        // or leave it as 'pending' if it's a network error (5xx or timeout).
        const isNetworkError = err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('timeout');
        if (!isNetworkError) {
          await markSyncTaskFailed(task.id, err.message);
        }
      }
    }
  } finally {
    isSyncing = false;
  }
}
