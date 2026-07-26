FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat git
# Public repo clone (no auth needed). Pin to main.
RUN git clone --depth 1 --branch main https://github.com/Deejpotter/online-emu.git .
RUN corepack enable && yarn install --frozen-lockfile
RUN yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
# Linux-safe defaults; saves/profiles/seed land here (mounted as a volume)
ENV GAMES_DIR=/data/games
ENV DATA_DIR=/data
ENV LIBRARY_SOURCE=r2

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && apk add --no-cache su-exec

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
