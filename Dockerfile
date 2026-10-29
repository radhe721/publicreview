# Multi-stage Docker build for BusinessListe

# Stage 1: Build client static assets
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production server runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

# Copy server package definitions and install production dependencies only
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev

# Copy server source code
COPY server/ ./server/

# Copy compiled frontend from client-builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Expose server port
EXPOSE 5001

# Start the server (runs pending migrations on startup, then serves API + static client)
CMD ["node", "server/src/server.js"]
