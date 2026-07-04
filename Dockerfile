# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies (use ci if package-lock is present, else install)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the rest of the application files
COPY . .

# Build the production application
RUN npm run build

# Stage 2: Serve the application with Nginx on port 3000
FROM nginx:alpine

# Copy the custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files from Stage 1 to Nginx public directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 3000
EXPOSE 3000

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
