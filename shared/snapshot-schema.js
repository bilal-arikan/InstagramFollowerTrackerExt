// Validation helpers for follower snapshot import/export

/**
 * Validate a single snapshot object.
 * Returns { valid: true, snapshot } or { valid: false, reason }.
 */
export function validateSnapshot(obj) {
  if (!obj || typeof obj !== "object") {
    return { valid: false, reason: "Snapshot must be an object." };
  }

  if (typeof obj.timestamp !== "number" || obj.timestamp <= 0) {
    return { valid: false, reason: "Snapshot missing valid timestamp." };
  }

  if (!Array.isArray(obj.followers)) {
    // Support legacy format with usernames array
    if (Array.isArray(obj.usernames)) {
      obj = {
        ...obj,
        followers: obj.usernames.map((u) => ({
          username: String(u),
          fullName: "",
          profilePicUrl: "",
        })),
      };
    } else {
      return { valid: false, reason: "Snapshot missing followers array." };
    }
  }

  for (let i = 0; i < obj.followers.length; i++) {
    const f = obj.followers[i];
    if (!f || typeof f !== "object" || typeof f.username !== "string") {
      return { valid: false, reason: `Invalid follower at index ${i}.` };
    }
  }

  const snapshot = {
    timestamp: obj.timestamp,
    count: typeof obj.count === "number" ? obj.count : obj.followers.length,
    scannedUser: typeof obj.scannedUser === "string" ? obj.scannedUser : "",
    followers: obj.followers.map((f) => ({
      username: String(f.username),
      fullName: typeof f.fullName === "string" ? f.fullName : "",
      profilePicUrl: typeof f.profilePicUrl === "string" ? f.profilePicUrl : "",
    })),
  };

  return { valid: true, snapshot };
}

/**
 * Validate an entire export file.
 * Accepts either a raw array of snapshots or a wrapper object { snapshots: [...] }.
 * Returns { valid: true, snapshots } or { valid: false, reason }.
 */
export function validateExportData(data) {
  if (!data) {
    return { valid: false, reason: "File is empty or not valid JSON." };
  }

  let arr;
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && Array.isArray(data.snapshots)) {
    arr = data.snapshots;
  } else {
    return { valid: false, reason: "Expected an array of snapshots or { snapshots: [...] }." };
  }

  if (arr.length === 0) {
    return { valid: false, reason: "No snapshots found in file." };
  }

  const validated = [];
  for (let i = 0; i < arr.length; i++) {
    const result = validateSnapshot(arr[i]);
    if (!result.valid) {
      return { valid: false, reason: `Snapshot #${i + 1}: ${result.reason}` };
    }
    validated.push(result.snapshot);
  }

  return { valid: true, snapshots: validated };
}
