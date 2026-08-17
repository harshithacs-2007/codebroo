# syntax=docker/dockerfile:1
FROM eclipse-temurin:26-jdk-jammy

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --home /app --shell /usr/sbin/nologin broo

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
RUN npm ci

COPY . .
RUN npm run build \
  && sed -i 's/\r$//' /app/scripts/docker-start.sh \
  && chmod +x /app/scripts/docker-start.sh \
  && mkdir -p /app/data /app/sandbox \
  && chown -R broo:broo /app

ENV NODE_ENV=production
ENV CODEBROO_HOST=0.0.0.0
ENV CODEBROO_PORT=8787
ENV CODEBROO_DATA_DIR=/app/data
ENV CODEBROO_SANDBOX_DIR=/app/sandbox
ENV CODEBROO_WEB_DIST=/app/apps/web/dist
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Start as root only to chown the persistent volume, then drop to broo.
USER root
CMD ["/app/scripts/docker-start.sh"]
