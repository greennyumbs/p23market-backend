# Base image
FROM node:20-alpine AS build

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and prisma schema
COPY . .

# Provide a dummy DATABASE_URL just for generation/validation during build
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unused"

# Generate Prisma Client and Build
RUN npx prisma generate
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /usr/src/app

# Only copy what we need for production
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/prisma ./prisma

# Expose the port the app runs on
EXPOSE 3000

# Use the new production start command that handles DB setup
CMD ["npm", "run", "prod:start"]
