FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
ENV GAMES_DIR=/data/games
ENV DATA_DIR=/data
ENV LIBRARY_SOURCE=r2
ENV SAVE_STORAGE=r2
ENV PROFILE_STORAGE=postgres

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && apk add --no-cache wget

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
