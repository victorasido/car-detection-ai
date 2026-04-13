import * as SQLite from "expo-sqlite";

// Open the database using the new async API in Expo SDK 50+
let dbPromise = null;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("vehiclesim.db");
  }
  return dbPromise;
}

/**
 * Initializes the database tables.
 * Call this early in the app startup lifecycle.
 */
export async function initDb() {
  try {
    const db = await getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("[DB] SQLite initialized: sync_queue table ready.");
  } catch (err) {
    console.error("[DB] Failed to initialize SQLite:", err);
  }
}

/**
 * Adds an API request payload to the sync queue.
 * @param {string} endpoint The API endpoint (e.g., '/analyze')
 * @param {object} payload The request arguments as a JSON serializable object
 */
export async function enqueueSyncTask(endpoint, payload) {
  try {
    const db = await getDb();
    const payloadStr = JSON.stringify(payload);
    const result = await db.runAsync(
      `INSERT INTO sync_queue (endpoint, payload, status) VALUES (?, ?, 'pending')`,
      [endpoint, payloadStr]
    );
    console.log(`[DB] Enqueued task for ${endpoint} with ID: ${result.lastInsertRowId}`);
    return result.lastInsertRowId;
  } catch (err) {
    console.error("[DB] Failed to enqueue sync task:", err);
    throw err;
  }
}

/**
 * Retrieves all pending tasks from the sync queue, ordered by oldest first.
 */
export async function getPendingSyncTasks() {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`);
    return rows;
  } catch (err) {
    console.error("[DB] Failed to get pending sync tasks:", err);
    return [];
  }
}

/**
 * Marks a specific task as completed (or deletes it).
 */
export async function removeSyncTask(id) {
  try {
    const db = await getDb();
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
    console.log(`[DB] Removed task ${id} from queue.`);
  } catch (err) {
    console.error(`[DB] Failed to remove sync task ${id}:`, err);
  }
}

/**
 * Marks a task as failed so it can be retried or inspected later.
 */
export async function markSyncTaskFailed(id, errorMessage) {
  try {
    const db = await getDb();
    await db.runAsync(`UPDATE sync_queue SET status = 'failed' WHERE id = ?`, [id]);
    console.log(`[DB] Marked task ${id} as failed: ${errorMessage}`);
  } catch (err) {
    console.error(`[DB] Failed to mark sync task ${id} as failed:`, err);
  }
}
