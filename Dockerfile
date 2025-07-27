FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-slim AS production
RUN apt-get update && apt-get install -y python3 python3-pip python3-dev build-essential libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir ezdxf pdf2image opencv-python-headless numpy Pillow

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