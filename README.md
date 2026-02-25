# Instagram Follower Tracker

A Chrome extension that tracks your Instagram followers over time and instantly shows who unfollowed you.

## Features

- **Scan Followers** — Automatically scrolls through the followers dialog and collects every follower with profile pictures.
- **Snapshot History** — Saves up to 10 timestamped snapshots locally.
- **Compare Snapshots** — See who unfollowed, who's new, and who stayed.
- **Search & Browse** — Filter any snapshot's follower list by name or username.
- **Privacy First** — All data stays in your browser. Nothing is sent to any server.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bilal-arikan/InstagramFollowerTrackerExt.git
   ```
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the project folder.

## Usage

1. Go to any Instagram profile page.
2. Click the extension icon and press **Scan Followers**.
3. After the scan, a snapshot is saved. Run another scan later and use **Compare** to see the differences.

## Project Structure

```
├── manifest.json              # Extension manifest (MV3)
├── background/                # Service worker, storage, diff algorithm
├── content-scripts/           # Follower scraper & DOM utilities
├── popup/                     # Extension popup UI
├── shared/                    # Constants & message types
├── styles/                    # Shared CSS
└── icons/                     # Extension icons
```

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (ES Modules)
- Chrome Storage & Messaging APIs

## License

[MIT](LICENSE)
