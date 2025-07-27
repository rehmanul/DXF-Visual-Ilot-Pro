FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create Python virtual environment and install packages
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install ezdxf pdf2image opencv-python-headless numpy Pillow

WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy application files
COPY dist/ ./dist/
COPY scripts/ ./scripts/

# Create directories and set permissions
RUN mkdir -p uploads exports && chmod 755 uploads exports

EXPOSE 10000

CMD ["node", "dist/index.js"]