# Deploying to Synology NAS (Docker)

This guide covers building the Docker images on your dev machine and running them on a Synology NAS via Container Manager.

## Prerequisites

- **Dev machine**: Docker Desktop (or Docker Engine) with `docker buildx` available
- **Synology NAS**: DSM 7.2+ with [Container Manager](https://www.synology.com/en-global/dsm/packages/ContainerManager) installed
- **Docker Hub account** (or another registry like GHCR)

---

## 1. Build and push images

Run these from the **repo root** on your dev machine.

First, create a multi-arch builder (one-time setup):

```bash
docker buildx create --use --name multiarch
```

Then build and push both images for `amd64` and `arm64` in one step. Docker Hub will automatically serve the correct architecture to whatever machine pulls the image:

```bash
docker login

docker buildx build --platform linux/amd64,linux/arm64 \
  -t noahziltener5/shithead-server:latest -f server/Dockerfile . --push

docker buildx build --platform linux/amd64,linux/arm64 \
  -t noahziltener5/shithead-client:latest -f client/Dockerfile . --push
```

---

## 2. Set up files on the NAS

SSH into the NAS (enable SSH under DSM → Control Panel → Terminal & SNMP), then create a directory for the project:

```bash
mkdir -p /volume1/docker/shithead-online
cd /volume1/docker/shithead-online
```

### 2a. Create the `.env` file

```bash
nano .env
```

Paste the following and fill in any values you want to enable:

```env
PORT=8000

# Optional: Discord webhook URLs (leave blank to disable)
DISCORD_FEEDBACK_WEBHOOK_URL=
DISCORD_GAME_WEBHOOK_URL=
DISCORD_ALERTS_WEBHOOK_URL=
```

### 2b. Create `docker-compose.yml`

```bash
nano docker-compose.yml
```

```yaml
services:
  server:
    image: noahziltener5/shithead-server:latest
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "deno", "eval", "const r = await fetch('http://localhost:8000/health'); if (!r.ok) Deno.exit(1)"]
      interval: 10s
      timeout: 5s
      retries: 3
    env_file:
      - .env

  client:
    image: noahziltener5/shithead-client:latest
    ports:
      - "8080:80"
    restart: unless-stopped
    depends_on:
      server:
        condition: service_healthy
```

> Port `8080` is used because port `80` is typically occupied by DSM's web interface. Change it to any free port you prefer.

---

## 3. Deploy

### Option A — Via SSH

```bash
cd /volume1/docker/shithead-online
docker compose up -d
```

### Option B — Via Container Manager UI

1. Open **Container Manager** in DSM
2. Go to **Project** → **Create**
3. Set the project path to `/volume1/docker/shithead-online`
4. Container Manager will detect `docker-compose.yml` automatically
5. Click **Next** and then **Done**

---

## 4. Access the app

Open a browser and navigate to:

```
http://<NAS_IP>:8080
```

Replace `<NAS_IP>` with your NAS's local IP address (found under DSM → Control Panel → Network).

To make it accessible from outside your home network, set up a port forward on your router for port `8080` pointing to the NAS IP.

---

## Updating to a new version

On your dev machine, rebuild and push:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t noahziltener5/shithead-server:latest -f server/Dockerfile . --push

docker buildx build --platform linux/amd64,linux/arm64 \
  -t noahziltener5/shithead-client:latest -f client/Dockerfile . --push
```

Then on the NAS (SSH or Container Manager → Project → Action → Pull and restart):

```bash
cd /volume1/docker/shithead-online
docker compose pull
docker compose up -d
```
