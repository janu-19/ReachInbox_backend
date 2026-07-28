FROM node:20-alpine

WORKDIR /app

# Install OpenSSL library dependencies for Prisma engine
RUN apk add --no-cache openssl

# Copy dependency mappings
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Generate Prisma client library bindings
RUN npx prisma generate

# Compile TypeScript to JavaScript
RUN npm run build

# Expose backend REST port
EXPOSE 5000

# Run schema migrations and boot Express server
CMD ["sh", "-c", "npx prisma db push && node dist/app.js"]
