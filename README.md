# LabShare PC Booking

A GitHub Pages booking dashboard for one shared lab PC used by three lab members.

## What It Does

- Shows whether the system is free or currently booked.
- Displays upcoming reservations, daily open windows, and weekly usage balance.
- Prevents overlapping bookings.
- Stores shared bookings in `data/bookings.json` through the GitHub Contents API.
- Runs as a static site on GitHub Pages, with no separate backend server.

## GitHub Setup

1. Create a GitHub repository and add these files.
2. Enable Pages with GitHub Actions as the source.
3. Open the deployed site.
4. In **GitHub storage**, enter the repository owner, repository name, branch, data path, and a GitHub token.

For writing bookings from the browser, use a fine-grained GitHub token limited to this repository with **Contents: Read and write** permission. The token is never committed to the repo; it is stored only in the browser, either for the session or on that device if selected.

## Team Names

Edit `data/bookings.json` to rename the three members:

```json
"members": [
  { "id": "member-1", "name": "Your Name", "color": "#127c78" },
  { "id": "member-2", "name": "Lab Member 2", "color": "#c98624" },
  { "id": "member-3", "name": "Lab Member 3", "color": "#416984" }
]
```

## Local Preview

Serve the folder with any static server and open the local URL. Example:

```powershell
python -m http.server 8080
```

The app can preview bookings in browser storage when GitHub storage is not connected, but shared updates require the GitHub connection.
