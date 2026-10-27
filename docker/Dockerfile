FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist-server-v2 ./dist-server-v2
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/scripts/create-admin.mjs ./scripts/create-admin.mjs
RUN mkdir -p /app/public/uploads && chown -R node:node /app/public
USER node
EXPOSE 5001
CMD ["node", "dist-server-v2/main.js"]

FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
