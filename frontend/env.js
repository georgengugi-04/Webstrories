// Runtime configuration for the GreenTrack frontend.
//
// This file is intentionally checked into the repo with safe local-dev
// defaults, so the site works out of the box with `npx serve` or any
// static file server — no build step required.
//
// In Docker, this exact file gets REGENERATED at container startup by
// frontend/docker-entrypoint.sh, which substitutes the real API_BASE_URL
// and WHATSAPP_NUMBER environment variables in. Don't hardcode values you
// want to change per-environment anywhere else — this is the one place.
window.GREENTRACK_API_BASE = "http://localhost:4000";
window.GREENTRACK_WHATSAPP_NUMBER = "254700110527";
