# Cloud Run image for the Next.js app in web/ (build context = repository root).
# Build:  docker build -t task-orchestration .
# Run:    docker run -p 8080:8080 task-orchestration

FROM node:24-alpine AS deps
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app/web
COPY --from=deps /app/web/node_modules ./node_modules
COPY web/ ./
# Supabase mode is opt-in at build time (the values are public, see README). Leave unset for the browser-only demo.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
RUN addgroup -S app && adduser -S app -G app
# `output: "standalone"` in next.config.ts produces a self-contained server in .next/standalone.
COPY --from=build --chown=app:app /app/web/.next/standalone ./
COPY --from=build --chown=app:app /app/web/.next/static ./.next/static
COPY --from=build --chown=app:app /app/web/public ./public
USER app
EXPOSE 8080
CMD ["node", "server.js"]
