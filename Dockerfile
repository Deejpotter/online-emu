# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat
COPY package.json yarn.lock ./
# Cache mount keeps downloaded packages between builds, so a lockfile change
# only fetches what changed and a slow registry doesn't fail the build.
# Use the image's bundled yarn; corepack would fetch yarn from npm on every build.
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
	(command -v yarn >/dev/null || corepack enable) && \
	yarn install --frozen-lockfile --prefer-offline --network-timeout 600000
COPY . .
# Next's incremental build cache survives between deploys.
RUN --mount=type=cache,target=/app/.next/cache yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
ENV GAMES_DIR=/data/games
ENV DATA_DIR=/data
ENV LIBRARY_SOURCE=r2
ENV SAVE_STORAGE=r2
ENV PROFILE_STORAGE=postgres

# Healthcheck uses BusyBox wget, which ships with alpine, so no apk fetch here.
COPY --from=builder /app/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/yarn.lock /app/server.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/.next ./.next

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
