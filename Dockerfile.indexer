FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "apps/indexer/dist/index.js"]
