# Build context is the repo root so npm workspaces can resolve @mailgi/mailgi.
#   docker build -f apps/ui/Dockerfile -t mailgi-ui .
FROM node:20-alpine
WORKDIR /app

# Manifests first, for layer caching
COPY package.json package-lock.json* ./
COPY packages/typescript/package.json packages/typescript/
COPY apps/ui/package.json apps/ui/
RUN npm install

COPY packages/typescript packages/typescript
COPY apps/ui apps/ui

EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "@mailgi/ui"]
