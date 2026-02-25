// Snapshot diff algorithm for follower tracking

/**
 * Compare two snapshots and return the diff.
 * @param {Object} older - { timestamp, followers: {username, fullName, profilePicUrl}[] }
 * @param {Object} newer - { timestamp, followers: {username, fullName, profilePicUrl}[] }
 * @returns {{ unfollowed: object[], newFollowers: object[], unchanged: number }}
 */
export function computeDiff(older, newer) {
  // Build maps keyed by username for fast lookup
  const olderMap = new Map(older.followers.map((f) => [f.username, f]));
  const newerMap = new Map(newer.followers.map((f) => [f.username, f]));

  const unfollowed = [];
  const newFollowers = [];
  const unchanged = [];

  for (const [username, follower] of olderMap) {
    if (!newerMap.has(username)) {
      unfollowed.push(follower);
    } else {
      unchanged.push(newerMap.get(username));
    }
  }

  for (const [username, follower] of newerMap) {
    if (!olderMap.has(username)) {
      newFollowers.push(follower);
    }
  }

  // Sort by username for consistent ordering
  unfollowed.sort((a, b) => a.username.localeCompare(b.username));
  newFollowers.sort((a, b) => a.username.localeCompare(b.username));
  unchanged.sort((a, b) => a.username.localeCompare(b.username));

  return {
    unfollowed,
    newFollowers,
    unchanged,
    olderDate: older.timestamp,
    newerDate: newer.timestamp,
    olderCount: older.followers.length,
    newerCount: newer.followers.length,
    unchangedCount: unchanged.length,
  };
}

/**
 * Create a snapshot object from a list of follower objects.
 * @param {Array<{username, fullName, profilePicUrl}>} followers
 * @param {string} scannedUser - Instagram username of the profile that was scanned
 */
export function createSnapshot(followers, scannedUser = "") {
  // Deduplicate by username, sort by username
  const uniqueMap = new Map(followers.map((f) => [f.username, f]));
  const sorted = [...uniqueMap.values()].sort((a, b) =>
    a.username.localeCompare(b.username)
  );

  return {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    scannedUser,
    followers: sorted,
    count: sorted.length,
  };
}
