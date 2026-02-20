FROM oven/bun:1 AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1
WORKDIR /app
COPY --from=install /app/node_modules node_modules
COPY src src
COPY assets assets
COPY package.json .

ENV HOST=0.0.0.0
ENV BASE_URL=http://localhost:36445
EXPOSE 36445

CMD ["bun", "src/index.ts"]
