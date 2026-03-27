FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY patches ./patches
# --ignore-scripts: evita postinstall antes de patch-package existir (lock antigo no servidor).
RUN npm ci --omit=dev --ignore-scripts \
    && npm install patch-package@8.0.1 --omit=dev \
    && npx patch-package
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
