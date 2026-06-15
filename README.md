# RTX 5090 Booking

A GitHub Pages booking dashboard for the shared RTX 5090 system.

## What It Does

- Shows whether the system is free or currently booked.
- Uses Supabase email/password signup and signin.
- Stores shared bookings in Supabase instead of GitHub commits.
- Prevents overlapping bookings in the UI and with a database constraint.
- Runs as a static site on GitHub Pages, with no GitHub token field.

## Supabase Setup

1. Open the Supabase project:

```text
https://liwamsxkjccrrozqmxfr.supabase.co
```

2. Go to **SQL Editor**.
3. Paste and run [supabase/schema.sql](supabase/schema.sql).
4. Go to **Authentication -> URL Configuration** and add the GitHub Pages URL as an allowed redirect URL:

```text
https://gogulnathsa123.github.io/RTX-5090-page/
```

5. Make sure **Authentication -> Providers -> Email** is enabled.

The site uses the Supabase project URL plus the frontend-safe publishable key. The old GitHub token field is no longer used.

## Local Preview

Serve the folder with any static server and open the local URL:

```powershell
python -m http.server 8080
```
