// Followers tab UI logic

document.addEventListener("DOMContentLoaded", () => {
  initFollowersTab();
});

// Cancel scan when popup closes
window.addEventListener("unload", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "CANCEL_OPERATION" }).catch(() => {});
    }
  });
});

function initFollowersTab() {
  const btnScan = document.getElementById("btn-scan-followers");
  const btnCompare = document.getElementById("btn-compare");
  const btnBack = document.getElementById("btn-back-to-snapshots");
  const searchBox = document.getElementById("follower-search");

  btnScan.addEventListener("click", handleScanButtonClick);
  btnCompare.addEventListener("click", handleCompare);
  btnBack.addEventListener("click", showSnapshotListView);
  searchBox.addEventListener("input", () => filterFollowerList(searchBox.value));

  // Initialize export/import button handlers
  initExportImport();

  // Load existing snapshots from storage on popup open
  loadSnapshots();

  // Listen for progress/completion messages from content script / service worker
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case "SCAN_FOLLOWERS_PROGRESS":
        updateScanProgress(message);
        break;
      case "SCAN_FOLLOWERS_COMPLETE":
        handleScanComplete(message);
        break;
      case "SCAN_FOLLOWERS_ERROR":
        handleScanError(message);
        break;
    }
  });
}

// ─── Scan / Stop ──────────────────────────────────────────────────────────────

let _isScanning = false;

function handleScanButtonClick() {
  if (_isScanning) {
    stopScan();
  } else {
    startScan();
  }
}

async function startScan() {
  _isScanning = true;
  setScanningUI(true);

  const response = await sendMessage({ type: "SCAN_FOLLOWERS" });

  if (response.error) {
    handleScanError({ error: response.error });
  }
}

function stopScan() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "CANCEL_OPERATION" }).catch(() => {});
    }
  });
  // UI will reset when SCAN_FOLLOWERS_COMPLETE arrives with partial data
}

function setScanningUI(scanning) {
  const btnScan = document.getElementById("btn-scan-followers");
  if (scanning) {
    btnScan.textContent = "Stop";
    btnScan.classList.remove("btn-primary");
    btnScan.classList.add("btn-danger");
    showElement("follower-progress");
    setText("follower-status", "Starting scan...");
    setProgress("follower-progress-fill", 0);
  } else {
    btnScan.textContent = "Scan Followers";
    btnScan.classList.remove("btn-danger");
    btnScan.classList.add("btn-primary");
    hideElement("follower-progress");
  }
}

function updateScanProgress(data) {
  setText("follower-status", data.status || `${data.count} followers found...`);
  setProgress("follower-progress-fill", Math.min(90, data.count / 10));
}

function handleScanComplete(data) {
  _isScanning = false;
  setScanningUI(false);

  if (data.snapshot) {
    showToast(`Scan complete — ${data.snapshot.count} followers saved.`, "success");
  }

  loadSnapshots();
}

function handleScanError(data) {
  _isScanning = false;
  setScanningUI(false);
  showToast(data.error || "An error occurred during scan.", "error");
}

// ─── Snapshot List ─────────────────────────────────────────────────────────────

async function loadSnapshots() {
  const response = await sendMessage({ type: "GET_SNAPSHOTS" });
  const snapshots = response.snapshots || [];

  const listEl = document.getElementById("snapshot-list");

  // Show export/import section and toggle export button
  showElement("export-import-section");
  const btnExport = document.getElementById("btn-export");

  if (snapshots.length === 0) {
    listEl.className = "empty-state";
    listEl.innerHTML = "<p>No snapshots yet. Scan your followers to create one.</p>";
    hideElement("compare-section");
    btnExport.disabled = true;
    return;
  }

  btnExport.disabled = false;

  listEl.className = "";
  listEl.innerHTML = snapshots
    .map(
      (s) => `
      <div class="snapshot-item" data-timestamp="${s.timestamp}">
        <div class="snapshot-info">
          <div class="snapshot-date">${formatDate(s.timestamp)}</div>
          <div class="snapshot-count">${s.count} followers${s.scannedUser ? ` &middot; @${escapeHTML(s.scannedUser)}` : ""}</div>
        </div>
        <button class="snapshot-delete" data-timestamp="${s.timestamp}" title="Delete">&times;</button>
      </div>
    `
    )
    .join("");

  // Click snapshot row → open detail view
  listEl.querySelectorAll(".snapshot-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".snapshot-delete")) return;
      const timestamp = parseInt(item.dataset.timestamp);
      const snapshot = snapshots.find((s) => s.timestamp === timestamp);
      if (snapshot) openSnapshotDetail(snapshot);
    });
  });

  // Delete handlers
  listEl.querySelectorAll(".snapshot-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const timestamp = parseInt(btn.dataset.timestamp);
      await sendMessage({ type: "DELETE_SNAPSHOT", timestamp });
      loadSnapshots();
    });
  });

  if (snapshots.length >= 2) {
    showElement("compare-section");
    populateCompareSelects(snapshots);
  } else {
    hideElement("compare-section");
  }
}

// ─── Snapshot Detail View ─────────────────────────────────────────────────────

let _currentDetailFollowers = [];

function openSnapshotDetail(snapshot) {
  _currentDetailFollowers = snapshot.followers || [];

  setText(
    "detail-snapshot-title",
    `${formatDate(snapshot.timestamp)} — ${snapshot.count} followers`
  );
  document.getElementById("follower-search").value = "";

  renderFollowerList(_currentDetailFollowers, "detail-follower-list");

  hideElement("snapshot-list-view");
  hideElement("compare-section");
  hideElement("diff-results");
  showElement("snapshot-detail-view");
}

function showSnapshotListView() {
  hideElement("snapshot-detail-view");
  showElement("snapshot-list-view");
  loadSnapshots();
}

function filterFollowerList(query) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? _currentDetailFollowers.filter(
        (f) =>
          f.username.toLowerCase().includes(q) ||
          (f.fullName || "").toLowerCase().includes(q)
      )
    : _currentDetailFollowers;

  renderFollowerList(filtered, "detail-follower-list");
}

// ─── Shared Rendering ─────────────────────────────────────────────────────────

function renderFollowerList(followers, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (followers.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:16px"><p>No followers found.</p></div>';
    return;
  }

  container.innerHTML = followers.map((f) => followerRowHTML(f)).join("");
}

function followerRowHTML(f) {
  const profileUrl = `https://www.instagram.com/${f.username}/`;
  const avatarHTML = f.profilePicUrl
    ? `<img class="follower-avatar" src="${escapeAttr(f.profilePicUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const placeholderLetter = (f.fullName || f.username || "?")[0].toUpperCase();
  const placeholderStyle = f.profilePicUrl ? "style=\"display:none\"" : "";

  return `
    <a class="follower-row" href="${escapeAttr(profileUrl)}" target="_blank">
      ${avatarHTML}
      <div class="follower-avatar-placeholder" ${placeholderStyle}>${escapeHTML(placeholderLetter)}</div>
      <div class="follower-info">
        <div class="follower-username">@${escapeHTML(f.username)}</div>
        ${f.fullName ? `<div class="follower-fullname">${escapeHTML(f.fullName)}</div>` : ""}
      </div>
    </a>
  `;
}

// ─── Compare ──────────────────────────────────────────────────────────────────

function populateCompareSelects(snapshots) {
  const selectOlder = document.getElementById("select-older");
  const selectNewer = document.getElementById("select-newer");

  const optionsHTML = snapshots
    .map(
      (s) =>
        `<option value="${s.timestamp}">${formatDate(s.timestamp)} (${s.count})</option>`
    )
    .join("");

  selectOlder.innerHTML = '<option value="">Select older snapshot...</option>' + optionsHTML;
  selectNewer.innerHTML = '<option value="">Select newer snapshot...</option>' + optionsHTML;

  if (snapshots.length >= 2) {
    selectOlder.value = snapshots[snapshots.length - 1].timestamp;
    selectNewer.value = snapshots[0].timestamp;
  }
}

async function handleCompare() {
  const olderTimestamp = parseInt(document.getElementById("select-older").value);
  const newerTimestamp = parseInt(document.getElementById("select-newer").value);

  if (!olderTimestamp || !newerTimestamp) {
    showToast("Please select both snapshots to compare.", "error");
    return;
  }

  if (olderTimestamp === newerTimestamp) {
    showToast("Please select two different snapshots.", "error");
    return;
  }

  const response = await sendMessage({
    type: "GET_DIFF",
    olderTimestamp,
    newerTimestamp,
  });

  if (response.error) {
    showToast(response.error, "error");
    return;
  }

  displayDiff(response.diff);
}

function displayDiff(diff) {
  showElement("diff-results");

  setText("stat-unfollowed", diff.unfollowed.length);
  setText("stat-new", diff.newFollowers.length);
  setText("stat-unchanged", diff.unchanged.length);

  setText("unfollowed-badge", `Unfollowed (${diff.unfollowed.length})`);
  renderFollowerList(diff.unfollowed, "unfollowed-list");

  setText("new-badge", `New Followers (${diff.newFollowers.length})`);
  renderFollowerList(diff.newFollowers, "new-list");

  setText("unchanged-badge", `Unchanged (${diff.unchanged.length})`);
  renderFollowerList(diff.unchanged, "unchanged-list");
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  // Auto-dismiss after 4s
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 4000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
