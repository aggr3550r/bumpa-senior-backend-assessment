ARG NODE_IMAGE=node:22.23.2-alpine3.24

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
# Container builds should be reproducible and non-interactive; Husky belongs on
# developer machines, not inside Docker image construction.
ENV HUSKY=0
COPY package*.json ./
# npm ci installs exactly from package-lock.json, which keeps Docker, CI, and
# local verification on the same dependency graph.
RUN npm ci --ignore-scripts

FROM dependencies AS development
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM ${NODE_IMAGE} AS build
WORKDIR /app
# Reuse the full dependency install from the first stage so TypeScript build
# tooling is available here without reinstalling packages.
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV HUSKY=0
ENV NODE_ENV=production
COPY package*.json ./
# The runtime image only needs production dependencies and compiled JS. npm is
# removed afterward to reduce the final attack surface reported by image scans.
RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
