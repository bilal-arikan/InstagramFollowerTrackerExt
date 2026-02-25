// Chrome storage CRUD operations for follower snapshots and settings
import { STORAGE_KEYS, CONFIG } from "../shared/constants.js";
import { validateExportData } from "../shared/snapshot-schema.js";

export async function saveSnapshot(snapshot) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SNAPSHOTS);
  const snapshots = data[STORAGE_KEYS.SNAPSHOTS] || [];

  snapshots.unshift(snapshot);

  if (snapshots.length > CONFIG.MAX_SNAPSHOTS) {
    snapshots.length = CONFIG.MAX_SNAPSHOTS;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.SNAPSHOTS]: snapshots });
  return snapshots;
}

export async function getSnapshots() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SNAPSHOTS);
  const raw = data[STORAGE_KEYS.SNAPSHOTS] || [];

  // Migrate old-format snapshots (usernames: string[]) on the fly
  return raw.map((s) => {
    if (s.followers) return s;
    if (Array.isArray(s.usernames)) {
      return {
        ...s,
        followers: s.usernames.map((u) => ({ username: u, fullName: "", profilePicUrl: "" })),
      };
    }
    return s;
  });
}

export async function importSnapshots(importData) {
  const validation = validateExportData(importData);
  if (!validation.valid) {
    return { error: validation.reason };
  }

  const data = await chrome.storage.local.get(STORAGE_KEYS.SNAPSHOTS);
  const existing = data[STORAGE_KEYS.SNAPSHOTS] || [];
  const existingTimestamps = new Set(existing.map((s) => s.timestamp));

  const newSnapshots = validation.snapshots.filter(
    (s) => !existingTimestamps.has(s.timestamp)
  );

  if (newSnapshots.length === 0) {
    return { added: 0, skipped: validation.snapshots.length };
  }

  const merged = [...existing, ...newSnapshots]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, CONFIG.MAX_SNAPSHOTS);

  await chrome.storage.local.set({ [STORAGE_KEYS.SNAPSHOTS]: merged });

  return {
    added: newSnapshots.length,
    skipped: validation.snapshots.length - newSnapshots.length,
  };
}

export async function deleteSnapshot(timestamp) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SNAPSHOTS);
  const snapshots = (data[STORAGE_KEYS.SNAPSHOTS] || []).filter(
    (s) => s.timestamp !== timestamp
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.SNAPSHOTS]: snapshots });
  return snapshots;
}
