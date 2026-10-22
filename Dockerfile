# The calendar list is baked into the bundle (__CALENDARS__) and the proxy needs the
# feed URLs at runtime, so the build runs when the container starts, from the CAL_*
# variables given by the compose file on the server. The private URLs never end up
# in the image. Restart the container after changing a calendar.
#
#   services:
#     boloxe-wallcal:
#       build: .
#       restart: unless-stopped
#       env_file: .env
#       labels:
#         - "traefik.http.services.boloxe-wallcal.loadbalancer.server.port=4173"
FROM node:24-alpine

WORKDIR /app
RUN chown node:node /app
USER node

# Dev dependencies included: `vite preview` serves the app and its /feeds proxy.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY --chown=node:node . .

EXPOSE 4173
CMD ["sh", "-c", "node_modules/.bin/vite build && exec node_modules/.bin/vite preview --host 0.0.0.0 --port 4173 --strictPort"]
