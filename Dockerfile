FROM node:20-alpine

WORKDIR /app

# Install OpenSSL library dependencies for Prisma engine
RUN apk add --no-cache openssl

# Copy dependency mappings
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files with cache buster
ARG BUILD_TIME=20260729_0643
COPY . .

# Generate Prisma client library bindings
RUN npx prisma generate

# Compile TypeScript to JavaScript
RUN npm run build

# Expose backend REST ports
EXPOSE 5001 8080 3000 80

# Run schema migrations and boot Express server
CMD ["sh", "-c", "npx prisma db push && node dist/app.js"]
