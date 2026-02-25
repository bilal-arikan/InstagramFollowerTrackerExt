// Export/Import UI logic for follower snapshots

function initExportImport() {
  const btnExport = document.getElementById("btn-export");
  const btnImport = document.getElementById("btn-import");
  const fileInput = document.getElementById("import-file-input");

  btnExport.addEventListener("click", handleExportSnapshots);
  btnImport.addEventListener("click", handleImportClick);
  fileInput.addEventListener("change", handleImportFileSelected);
}

async function handleExportSnapshots() {
  const response = await sendMessage({ type: "GET_SNAPSHOTS" });
  const snapshots = response.snapshots || [];

  if (snapshots.length === 0) {
    showToast("No snapshots to export.", "error");
    return;
  }

  const stripPics = document.getElementById("chk-strip-pics").checked;

  const exportData = snapshots.map((s) => ({
    timestamp: s.timestamp,
    count: s.count,
    scannedUser: s.scannedUser || "",
    followers: s.followers.map((f) => ({
      username: f.username,
      fullName: f.fullName || "",
      profilePicUrl: stripPics ? "" : (f.profilePicUrl || ""),
    })),
  }));

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ig-followers-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported ${snapshots.length} snapshot(s).`, "success");
}

function handleImportClick() {
  const fileInput = document.getElementById("import-file-input");
  fileInput.value = "";
  fileInput.click();
}

function handleImportFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    let data;
    try {
      data = JSON.parse(ev.target.result);
    } catch {
      showToast("Invalid JSON file.", "error");
      return;
    }

    const response = await sendMessage({
      type: "IMPORT_SNAPSHOTS",
      data,
    });

    if (response.error) {
      showToast(response.error, "error");
      return;
    }

    const parts = [];
    if (response.added > 0) parts.push(`${response.added} imported`);
    if (response.skipped > 0) parts.push(`${response.skipped} duplicate skipped`);

    showToast(parts.join(", ") + ".", "success");
    loadSnapshots();
  };

  reader.onerror = () => {
    showToast("Failed to read file.", "error");
  };

  reader.readAsText(file);
}
