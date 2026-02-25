// Central message router for the extension
import { MSG } from "../shared/message-types.js";
import { saveSnapshot, getSnapshots, deleteSnapshot } from "./storage-manager.js";
import { computeDiff, createSnapshot } from "./follower-tracker.js";

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case MSG.SCAN_FOLLOWERS:
      return handleScanFollowers(message);

    case MSG.SCAN_FOLLOWERS_COMPLETE:
      return handleScanComplete(message);

    case MSG.GET_SNAPSHOTS:
      return { snapshots: await getSnapshots() };

    case MSG.GET_DIFF:
      return handleGetDiff(message);

    case MSG.DELETE_SNAPSHOT:
      return { snapshots: await deleteSnapshot(message.timestamp) };

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

async function handleScanFollowers(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url?.includes("instagram.com")) {
    return { error: "Please navigate to an Instagram profile page first." };
  }

  chrome.tabs.sendMessage(tab.id, {
    type: MSG.SCAN_FOLLOWERS,
    targetUser: message.targetUser,
  });

  return { started: true };
}

async function handleScanComplete(message) {
  const snapshot = createSnapshot(message.followers, message.scannedUser || "");
  const snapshots = await saveSnapshot(snapshot);

  chrome.runtime.sendMessage({
    type: MSG.SCAN_FOLLOWERS_COMPLETE,
    snapshot,
    totalSnapshots: snapshots.length,
  }).catch(() => {});

  return { snapshot, totalSnapshots: snapshots.length };
}

async function handleGetDiff(message) {
  const snapshots = await getSnapshots();
  const older = snapshots.find((s) => s.timestamp === message.olderTimestamp);
  const newer = snapshots.find((s) => s.timestamp === message.newerTimestamp);

  if (!older || !newer) {
    return { error: "One or both snapshots not found." };
  }

  return { diff: computeDiff(older, newer) };
}
