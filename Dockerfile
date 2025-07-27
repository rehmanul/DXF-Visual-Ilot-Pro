FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS production
RUN apk add --no-cache python3 py3-pip
RUN pip install --no-cache-dir ezdxf pdf2image opencv-python numpy Pillow

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY scripts/ ./scripts/

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN mkdir -p uploads exports && chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 10000

CMD ["node", "dist/index.js"]