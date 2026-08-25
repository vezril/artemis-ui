# Artemis UI — multi-stage build producing a small standalone Next.js server image.
# Published to Docker Hub as <user>/artemisui by the release workflow; deployed by
# Codex behind Traefik + cert-manager TLS.

# ---- deps: install production + build dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the app into a standalone bundle ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are inlined into the browser bundle at BUILD time (chart env is server-side only).
# Default to the same-origin BFF proxy (/api/artemis) so the image is env-agnostic: the browser
# calls this app's own origin and the server-side proxy forwards to ARTEMIS_UPSTREAM at runtime.
ARG NEXT_PUBLIC_ARTEMIS_BASE_URL=/api/artemis
ENV NEXT_PUBLIC_ARTEMIS_BASE_URL=$NEXT_PUBLIC_ARTEMIS_BASE_URL
RUN npm run build

# ---- runner: minimal runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# The standalone output includes a minimal server.js + traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
