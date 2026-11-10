# Image officielle Playwright : Chromium et ses dépendances système sont inclus.
# La version doit correspondre à celle de "playwright" dans package.json.
FROM mcr.microsoft.com/playwright:v1.65.0-noble
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
RUN mkdir -p /data && chown -R pwuser:pwuser /data /app
USER pwuser
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
