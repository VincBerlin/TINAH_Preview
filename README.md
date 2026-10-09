# TINAH Preview

Responsive, minimal booking preview with the supplied coastal video, original black brand artwork, an immediate video entrance and all supplied booking links. English visitor copy. The brand artwork is the original PNG with its white background made transparent.

## Start locally

Requires Node.js 22 or newer. No third-party packages or build step.

```sh
npm start      # http://localhost:4173
npm test       # signing, media mapping and bucket fallback
```

The hero videos live in `public/media/`, the only folder that goes to the bucket; they are served locally when no bucket is configured. Poster, logo and font stay in `public/assets/` and are always served by the site itself. Wide screens get the full 26-second original (1920×1080, 60 fps, H.264, untouched). Portrait screens (aspect ratio up to 7:10, i.e. phones) get `hero-portrait.mp4`, the centre 720×1080 crop of the same footage: the pixels a phone shows anyway, at 14.7 MB instead of 52.8 MB. The posters follow the same rule (`hero-poster-portrait.webp` / `hero-poster.webp`, JPEG fallback). With Data Saver enabled, the poster stays and no video loads.

## Railway deployment with a Storage Bucket

`railway.json` sets the start command (`npm start`) and the health check (`/health`). The server binds to `0.0.0.0` on Railway's `PORT`, compresses HTML/CSS/JS (Brotli or gzip) and caches versioned assets for a year.

Railway buckets are private. Only the video goes there. The server hands the page presigned bucket URLs for it, and browsers stream the video directly from the bucket: bucket egress is free on Railway, service egress is not, and the Node service never streams the 50 MB video. Range requests (needed for video on iOS) work natively.

1. In the Railway project, create a bucket (e.g. `tinah-media`) next to the web service.
2. In the web service's variables, reference the bucket's credentials: `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `ENDPOINT`, `REGION` (e.g. `BUCKET=${{tinah-media.BUCKET}}`). The AWS SDK preset names (`AWS_ACCESS_KEY_ID`, `AWS_ENDPOINT_URL_S3`, …) work too. Set `BUCKET_PATH_STYLE=true` only if the bucket's Credentials tab asks for path-style URLs.
3. Upload the videos once from this folder: `railway run npm run media:upload`. Re-running skips files that are already there; `npm run media:upload -- --dry-run` lists files and keys.
4. Deploy (or redeploy). The log says how many files come from the bucket, e.g. `Video: 2/2 files served from bucket …`.

Bucket keys contain a content hash (`media/hero.8e4db2b4c290.mp4`), stored with `Cache-Control: public, max-age=31536000, immutable`. Replace a video in `public/media/`, upload and deploy: it gets a new key, so nobody sees a stale copy. Signed URLs stay identical for three days (browsers cache the video) and remain valid for at least four more days.

Nothing breaks before the upload or when the bucket is unreachable: the server checks each file in the bucket at start and every 10 minutes and serves `/media/` for anything missing, and the page falls back to the bundled copy if the bucket video fails to load. Bucket credentials stay on the server; only signed, expiring URLs reach the browser.

The supplied Spotify link, `https://tr.ee/FuFQHdoNV4`, is the default; set `SPOTIFY_URL` only to override it. Variables are read when the server starts. `.env.example` documents them; for a local env file use `node --env-file=.env server.mjs`.

All book links navigate directly; no message or booking is submitted by the website itself. Instagram opens the supplied profile's Reels tab.

## Motion and accessibility

The site starts immediately with the hero; no image loader or blocking intro remains. Reduced-motion preferences disable decorative movement and pause background video. Hero playback has no visible controls and stops off-screen or when the page is hidden. White hero text, the compact original black logo, gradual section entrances and soft hero parallax keep the experience calm. Mobile styles are the base; columns are introduced at wider breakpoints. On phones, a soft top and bottom shade and a stronger text shadow keep the white hero text legible over bright surf; small labels are at least 11px; landscape phones get a compact hero without overlaps; links and buttons give touch feedback; `viewport-fit=cover` with safe-area insets uses the full width on notched iPhones. The logo is pre-rendered as a transparent image (the same black-ink calculation the earlier SVG filter did at runtime), which keeps scrolling smooth on phones. Form inputs use 16px text and labelled fields. The contact form is centred in a single column without a photograph.

## Contact form — preview mode

The form validates name, email, a positive whole-number guest count, arrival and departure, then prepares a URL-encoded email to bookings@thepassionfruit.co. Departure must be after arrival; past arrival dates are rejected. The message is optional. Guest count, dates and the number of nights are included in the email and copyable text. Date calculations use UTC calendar days to avoid daylight-saving errors. The guest chooses “Open email app” to send from their own mail application, or “Copy enquiry” as a fallback. It never claims that the message was sent. Nothing is stored on the server or sent to a third-party form service. A live submission service has not been connected. No JavaScript: the direct email link remains available.

## Assets and verification

WhatsApp symbol: Bootstrap Icons (MIT), https://github.com/twbs/icons. The corresponding license is included. The symbol uses the recognizable green brand color.

Checked in browser at 320px, 390px and 1440px (and, after the October 2026 mobile pass, at 844×390 landscape and 768px): no horizontal overflow, native required-field validation, correctly encoded email draft, no loader, a slim animated line below the centred mobile hero text (scroll cue), the original 1920×1080 video and the contact form. Test inputs were cleared; no email was sent.

## Design refinement — September 2026

The revised design combines locally hosted Allerta Stencil headings matching the original logo lettering, a centred vertical list of booking and social links, generous spacing and a full-width #B7410E terracotta contact section. The original black hero artwork and untouched Full HD video remain. Mobile layouts remain the default; guest/date fields adapt to 320px, 390px and desktop. Browser checks confirmed invalid departure dates are blocked and a valid three-guest, five-night enquiry includes every stay detail. No email was sent.

The middle section contains the supplied two-paragraph introduction above six centred links, in order: WhatsApp, Email us, Booking.com, Airbnb, Instagram and Spotify. Its photographs and descriptive blocks have been removed. The hero and contact section remain unchanged. Allerta Stencil is distributed under the SIL Open Font License; the font and license are bundled locally. The WhatsApp mark retains its own green brand color.
