// Chrome storage CRUD operations for follower snapshots and settings
import { STORAGE_KEYS, CONFIG } from "../shared/constants.js";

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

export async function deleteSnapshot(timestamp) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SNAPSHOTS);
  const snapshots = (data[STORAGE_KEYS.SNAPSHOTS] || []).filter(
    (s) => s.timestamp !== timestamp
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.SNAPSHOTS]: snapshots });
  return snapshots;
}
