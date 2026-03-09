FROM denoland/deno:2.3.1

WORKDIR /app

COPY server/deno.json server/deno.lock ./server/
COPY shared/ ./shared/

RUN cd server && deno install --frozen

COPY server/ ./server/

EXPOSE 8000
CMD ["deno", "task", "--config", "server/deno.json", "start"]
