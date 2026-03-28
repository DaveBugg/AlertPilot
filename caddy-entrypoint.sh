#!/bin/sh
# Build Caddy address from DOMAIN + optional WEB_PORT
DOMAIN="${DOMAIN:-localhost}"

if [ -n "$WEB_PORT" ]; then
  export CADDY_ADDRESS="${DOMAIN}:${WEB_PORT}"
else
  export CADDY_ADDRESS="${DOMAIN}"
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
