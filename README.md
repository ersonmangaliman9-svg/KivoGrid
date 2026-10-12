# KIVO Grid

Photo grid maker (2-9 photos, 16 templates, 14 filters, motion, PNG + animated reel export).
Static web app: no build step, no backend, no database. Photos never leave the user's browser.

## Run locally
    python3 -m http.server 8000     # then open http://localhost:8000
(Must be served over http; opening index.html by double-click will not load the JS modules.)

## Settings
Edit `js/config.js` -> set `FACEBOOK_URL` to your page/Messenger link (e.g. https://m.me/yourpage)
to show a "Message KIVO on Facebook" button in the export sheet.

## Deploy
1. Push this folder to a GitHub repo.
2. Import the repo in Vercel (Framework Preset: Other, no build command, no output dir).
