# RTX 5090 Booking

A GitHub Pages booking dashboard for the shared RTX 5090 system.

## What It Does

- Shows whether the system is free or currently booked.
- Displays upcoming reservations, daily open windows, and weekly usage balance.
- Uses email login as the booking identity, so the user list is not limited to three people.
- Prevents overlapping bookings.
- Stores shared bookings in `data/bookings.json` through the GitHub Contents API.
- Keeps storage locked to `GogulnathSA123/RTX-5090-page`.
- Runs as a static site on GitHub Pages, with no separate backend server.

## GitHub Setup

1. Enable Pages with GitHub Actions as the source.
2. Open the deployed site.
3. Sign in with email under **Mail login**.
4. In **GitHub storage**, paste a GitHub token and connect.

The repository, branch, and data path are fixed in the app:

```text
GogulnathSA123/RTX-5090-page
main / data/bookings.json
```

If the first Pages deploy fails with `Get Pages site failed`, the repository does not have Pages enabled yet. You can fix it either way:

- Go to **Settings -> Pages** and set the source to **GitHub Actions**.
- Or add a repository secret named `PAGES_TOKEN` with Pages write permission, then rerun the workflow. The workflow will use that token to enable Pages automatically.

For writing bookings from the browser, use a fine-grained GitHub token limited to this repository with **Contents: Read and write** permission. The token is never committed to the repo; it is stored only in the browser, either for the session or on that device if selected.

## Members

Members are created automatically from email login when they book. There is no fixed member limit.

## Local Preview

Serve the folder with any static server and open the local URL. Example:

```powershell
python -m http.server 8080
```
