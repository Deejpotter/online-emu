# Self-contained build: clone the public repo directly so Coolify's
# dockerfile build works regardless of whether the GitHub source is linked
# in the Coolify UI (this homelab's API github-source linking is broken).
# The inline Dockerfile is honored by Coolify; the build context it provides
# is irrelevant because we fetch the real source here.

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat git
# Public repo clone (no auth needed). Pin to main.
RUN git clone --depth 1 --branch main https://github.com/Deejpotter/online-emu.git .
RUN npm install --legacy-peer-deps
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"
# Linux-safe default; saves/profiles/seed land here (mounted as a volume)
ENV GAMES_DIR=/data/games
ENV DATA_DIR=/data
ENV LIBRARY_SOURCE=r2

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && apk add --no-cache su-exec

EXPOSE 3100
ENTRYPOINT ["/docker-entrypoint.sh"]
