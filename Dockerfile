# syntax=docker/dockerfile:1.7

# ---- base ----------------------------------------------------------------
# Pinned to match .bun-version; -slim is Debian-based (avoids alpine/musl
# Prisma engine issues; smaller than full debian).
FROM oven/bun:1.3.11-slim AS base
WORKDIR /app

# ---- build ---------------------------------------------------------------
# Full install (dev + prod deps) for tooling: prisma, vite, typescript.
# Then typecheck-via-build, prisma generate, vite SPA build.
FROM base AS build
COPY package.json bun.lock ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY core/package.json ./core/
RUN bun install --frozen-lockfile

COPY . .
ENV NODE_ENV=production

# Prisma 7's config loader requires DATABASE_URL to be set even though
# `generate` doesn't connect; pass a syntactically-valid placeholder.
RUN cd server && DATABASE_URL=postgres://build@build/build bunx prisma generate

# Vite builds the React SPA into client/dist/
RUN bun run --filter '@helpdesk/client' build

# ---- release -------------------------------------------------------------
# Fresh image with only production deps. The install MUST happen after the
# workspace source directories are present, otherwise bun can't create the
# workspace symlinks (node_modules/@helpdesk/core etc.) that the runtime
# resolves against.
FROM base AS release
ENV NODE_ENV=production

# Manifests first (cached layer when unchanged)
COPY package.json bun.lock ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY core/package.json ./core/

# Workspace source — required for `bun install` to create workspace symlinks
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/prisma ./server/prisma
# prisma.config.ts is where the datasource URL is wired (schema.prisma has
# no inline `url`). preDeployCommand `prisma migrate deploy` needs this.
COPY --from=build /app/server/prisma.config.ts ./server/prisma.config.ts
COPY --from=build /app/server/knowledge-base.md ./server/knowledge-base.md
COPY --from=build /app/core/src ./core/src

# Built SPA
COPY --from=build /app/client/dist ./client/dist

# Production-only install — drops dev deps (vite, biome, etc.) and wires
# up the workspace symlinks. --linker=hoisted gives one top-level
# node_modules; bun's default "isolated" linker creates per-workspace
# node_modules but skips creating one for the `core/` workspace whose only
# consumer is `server/`, so core/src/schemas.ts couldn't resolve zod.
RUN bun install --frozen-lockfile --production --linker=hoisted

EXPOSE 3000
USER bun
CMD ["bun", "server/src/index.ts"]
