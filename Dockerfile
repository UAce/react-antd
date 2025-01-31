# Name the node stage "builder"
FROM node:14.16.0 AS builder
# Set working directory
WORKDIR /app
# Copy all files from current directory to working dir in image
COPY . .
# install node modules
RUN npm install
# Build
RUN npm run build


FROM node:14.16.0-alpine
# Set working directory
WORKDIR /app
# Install serve
RUN npm install -g serve
# Copy build folder from builder stage
COPY --from=builder /app/build ./build
# Start serving
ENTRYPOINT ["serve", "-s", "build"]

# # nginx state for serving content
# FROM nginx:alpine
# # Set working directory to nginx asset directory
# WORKDIR /usr/share/nginx/html
# # Remove default nginx static assets
# RUN rm -rf ./*
# # Copy static assets from builder stage
# COPY --from=builder /app/build .
# # Containers run nginx with global directives and daemon off
# ENTRYPOINT ["nginx", "-g", "daemon off;"]