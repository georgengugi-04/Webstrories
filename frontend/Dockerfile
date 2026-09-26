# ---- GreenTrack frontend: static HTML/CSS/JS served by nginx ----
# There's no framework build step here (plain HTML/CSS/JS, no bundler), so
# this is a single-stage image: copy the site, configure nginx, done.
# If a build step is ever introduced (e.g. moving to Vite/Next), add a
# `node:20-alpine AS build` stage above this one and COPY --from=build.

FROM nginx:1.27-alpine

# Non-root nginx user is already set up by the base image (nginx:alpine
# runs worker processes as `nginx` by default under docker); we just need
# to make sure our added files are readable by it.

# Custom nginx config: clean caching rules, security headers, gzip.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint that regenerates env.js from real environment variables
# before nginx starts, so the API base URL is configurable per-deploy
# without rebuilding the image.
COPY docker-entrypoint.sh /docker-entrypoint.d/40-greentrack-env.sh
RUN chmod +x /docker-entrypoint.d/40-greentrack-env.sh

# Site files — copied explicitly (not `COPY . .`) so Docker-only files
# like this Dockerfile, nginx.conf, and the entrypoint script never end up
# served as part of the public site.
COPY *.html /usr/share/nginx/html/
COPY *.css /usr/share/nginx/html/
COPY *.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

# nginx:alpine's own entrypoint already runs every executable script in
# /docker-entrypoint.d/ before starting nginx — no CMD override needed.

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null || exit 1
