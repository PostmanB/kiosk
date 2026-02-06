FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM caddy:2-alpine

WORKDIR /srv

COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
COPY --from=build /app/dist /srv

RUN chmod +x /usr/bin/docker-entrypoint.sh

ENV VITE_SUPABASE_URL=""
ENV VITE_SUPABASE_ANON_KEY=""
ENV VITE_KIOSK_PIN=""
ENV VITE_STATS_PIN=""

EXPOSE 80

ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
