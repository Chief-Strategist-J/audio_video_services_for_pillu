FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy source
COPY . .

# Build TypeScript sources
RUN npm run build

# Expose ports (documented, actual mappings are controlled by docker-compose + .env)
EXPOSE ${API_PORT}
EXPOSE ${MEDIA_MIN_PORT}-${MEDIA_MAX_PORT}/udp

# Environment
ENV NODE_ENV=production

# Start command
CMD ["npm", "start"]
