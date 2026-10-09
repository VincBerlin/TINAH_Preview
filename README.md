# TINAH Preview

Responsive, minimal booking preview with the supplied coastal video, original black brand artwork, an immediate video entrance and all supplied booking links. English visitor copy. The brand artwork is reproduced from the original PNG through an SVG alpha filter; its white background is transparent at render time.

## Start locally

Requires Node.js 22 or newer. No third-party packages or build step.

```sh
npm start
```

Open http://localhost:4173. The video, photos and logo are included locally. The full 26-second video retains the original 1920×1080 H.264 video stream without re-encoding or resizing. It is remuxed into a silent MP4 with fast-start metadata. The original source remains untouched.

## Railway preparation

Deploy this directory as a Node service. Start command: `npm start`. The server binds to `0.0.0.0` and uses Railway's `PORT`. Health check: `/health`.

Set `HERO_VIDEO_URL` to a stable HTTPS URL delivering the MP4 from your bucket. The browser must be able to fetch that URL without secret credentials. If the bucket is private, use an authenticated server-side media proxy or a suitable signed delivery URL; a bare S3 bucket path is not a browser video URL. Use `Content-Type: video/mp4` and support byte-range requests. Do not put bucket credentials into public config. The source falls back to the bundled video if an external URL fails; the poster remains available when video playback is unavailable.

The supplied Spotify link, `https://tr.ee/FuFQHdoNV4`, is included by default on the Spotify text link. Set `SPOTIFY_URL` only to override it. The supplied short link currently redirects to the property’s Linktree page; the exact requested URL is preserved. Both variables are read when the server starts; restart/redeploy after changing them. `.env.example` documents the variables; for a local env file use `node --env-file=.env server.mjs`.

No deployment or bucket upload has been performed. All book links navigate directly; no message or booking is submitted by the website itself. Instagram opens the supplied profile's Reels tab.

## Motion and accessibility

The site starts immediately with the hero; no image loader or blocking intro remains. Reduced-motion preferences disable decorative movement and pause background video. Hero playback has no visible controls and stops off-screen or when the page is hidden. White hero text, the compact original black logo, gradual section entrances and soft hero parallax keep the experience calm. Mobile styles are the base; columns are introduced at wider breakpoints. Form inputs use 16px text and labelled fields. The contact form is centred in a single column without a photograph.

## Contact form — preview mode

The form validates name, email, a positive whole-number guest count, arrival and departure, then prepares a URL-encoded email to bookings@thepassionfruit.co. Departure must be after arrival; past arrival dates are rejected. The message is optional. Guest count, dates and the number of nights are included in the email and copyable text. Date calculations use UTC calendar days to avoid daylight-saving errors. The guest chooses “Open email app” to send from their own mail application, or “Copy enquiry” as a fallback. It never claims that the message was sent. Nothing is stored on the server or sent to a third-party form service. A live submission service has not been connected. No JavaScript: the direct email link remains available.

## Assets and verification

WhatsApp symbol: Bootstrap Icons (MIT), https://github.com/twbs/icons. The corresponding license is included. The symbol uses the recognizable green brand color.

Checked in browser at 320px, 390px and 1440px: no horizontal overflow, native required-field validation, correctly encoded email draft, no loader, a slim animated line below the centred mobile hero text (scroll cue), the original 1920×1080 video and the contact form. Test inputs were cleared; no email was sent.

## Design refinement — September 2026

The revised design combines locally hosted Allerta Stencil headings matching the original logo lettering, a centred vertical list of booking and social links, generous spacing and a full-width #B7410E terracotta contact section. The original black hero artwork and untouched Full HD video remain. Mobile layouts remain the default; guest/date fields adapt to 320px, 390px and desktop. Browser checks confirmed invalid departure dates are blocked and a valid three-guest, five-night enquiry includes every stay detail. No email was sent.

The middle section contains the supplied two-paragraph introduction above six centred links, in order: WhatsApp, Email us, Booking.com, Airbnb, Instagram and Spotify. Its photographs and descriptive blocks have been removed. The hero and contact section remain unchanged. Allerta Stencil is distributed under the SIL Open Font License; the font and license are bundled locally. The WhatsApp mark retains its own green brand color.
