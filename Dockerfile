FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM python:3.9-slim AS python-deps
RUN pip install --no-cache-dir ezdxf>=1.0.0 pdf2image>=1.16.0 opencv-python>=4.8.0 numpy>=1.24.0 Pillow>=10.0.0

FROM node:18-alpine AS production

RUN apk add --no-cache python3 py3-pip
COPY --from=python-deps /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY scripts/ ./scripts/

# Install only production dependencies
RUN npm ci --only=production

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN mkdir -p uploads exports && chown -R nodejs:nodejs uploads exports /app

USER nodejs
EXPOSE 10000

CMD ["node", "dist/index.js"]