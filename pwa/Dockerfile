FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

# Bake server URLs into the bundle at build time.
# Pass via docker-compose build args or --build-arg flags.
ARG VITE_NTFY_URL=""
ARG VITE_RUNNER_URL=""
ARG VITE_OPS_TOPIC="ops-alerts"
ARG VITE_DEV_TOPIC="dev-alerts"
ENV VITE_NTFY_URL=$VITE_NTFY_URL \
    VITE_RUNNER_URL=$VITE_RUNNER_URL \
    VITE_OPS_TOPIC=$VITE_OPS_TOPIC \
    VITE_DEV_TOPIC=$VITE_DEV_TOPIC

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
