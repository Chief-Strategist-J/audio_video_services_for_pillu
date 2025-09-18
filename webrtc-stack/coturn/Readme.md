# Coturn — TURN/STUN + Logs (Loki/Promtail/Grafana)

Self-contained, open-source, Dockerized stack for NAT traversal (coturn) and log observability (Loki + Promtail + Grafana).  
This README documents *only* the `coturn/` folder and how to run, configure, and operate it locally and on cloud.

---

## Contents (this folder)

```
coturn/
├─ docker-compose.yml        # runs coturn + loki + promtail + grafana (isolated stack)
├─ Dockerfile                # builds coturn image
├─ turnserver.conf           # TURN/STUN configuration (edit IP/realm/creds here)
├─ loki-config.yml           # Loki single-process config (local filesystem)
├─ promtail-config.yml       # Promtail ships coturn/logs/turn.log → Loki
├─ grafana/
│  ├─ provisioning/
│  │  ├─ datasources/datasources.yml   # preprovisions Loki datasource
│  │  └─ dashboards/dashboards.yml     # auto-loads dashboards from ./grafana/dashboards
│  └─ dashboards/coturn-logs.json      # simple logs dashboard
├─ logs/                     # persisted logs from coturn (mounted into container)
│  ├─ turn.log
│  ├─ turnserver.pid
│  └─ turn_*.log             # rotated logs (if any)
└─ reset_and_up.sh           # (optional) aggressive Docker reset + bring-up helper
```

> **Memory (idle):** coturn ≈ 50 MB; Loki ≈ 200 MB; Grafana ≈ 200 MB; Promtail ≈ 30–50 MB → **~400–600 MB** total.

---

## Quick start (local)

1) Ensure you’re in this folder:
```bash
cd /home/j/live/audio_video_services_for_pillu/webrtc-stack/coturn
```

2) Make sure the logs directory exists (compose mounts it):
```bash
mkdir -p logs
```

3) Bring the stack up:
```bash
docker compose up -d --build
```

4) Verify containers and logs:
```bash
docker ps
docker logs -f coturn
docker logs -f coturn-promtail
docker logs -f coturn-loki
docker logs -f coturn-grafana
```

5) Open Grafana:
- URL: **http://localhost:3000**  
- Login: **admin / admin** (change in Grafana UI)  
- Dashboard: **coturn logs** (preloaded)  
- Explore logs with query: `{job="coturn"}`

---

## Configure your WebRTC clients

Use this ICE configuration in your **browser** or **Python aiortc** client (adjust when you change IP/creds):

```json
{
  "iceServers": [
    { "urls": ["stun:150.107.191.52:3478"] },
    {
      "urls": [
        "turn:150.107.191.52:3478?transport=udp",
        "turn:150.107.191.52:3478?transport=tcp"
      ],
      "username": "pillu",
      "credential": "strongpassword123"
    }
  ]
}
```

---

## What to edit (and where you get values)

Edit **`turnserver.conf`**:

- `external-ip=150.107.191.52`  
  - Your server’s **public IPv4**.  
  - Find it on Linux: `curl ifconfig.me` (prints the IP).  
  - Change whenever the server IP changes.

- `realm=pillustun.local`  
  - Authentication realm (string).  
  - Keep as placeholder locally; later set to a **real domain** you control (e.g., `turn.yourdomain.com`).

- `user=pillu:strongpassword123`  
  - **username:password** for TURN auth (long-term credentials).  
  - Replace with a strong secret for production.

- `listening-port=3478`, `min-port=49160`, `max-port=49200`  
  - TURN/STUN and relay ports (keep defaults unless you must change them).  
  - Open these in your firewall on cloud.

Logging is already enabled:
- `log-file=/var/log/turnserver/turn.log` (host-mounted at `./logs/turn.log`)  
- `simple-log` and `pidfile` are set

---

## Local vs. cloud

### Local (now)
- Works as is on the same machine (clients can point to `127.0.0.1` or your LAN IP).
- Grafana and Loki are exposed on your localhost: `3000` and `3100`.

### Cloud (later)
1) Set `external-ip` in `turnserver.conf` to your **public cloud IP**.  
2) Open your VM firewall / security group:
   - UDP **3478** (TURN/STUN)
   - TCP **3478** (TCP fallback)
   - UDP **49160–49200** (relay range)
3) Update client ICE URLs to your **public IP or domain**.  
4) (Recommended) change `realm` to a real domain (e.g., `turn.yourdomain.com`).  
5) (Optional) bind Grafana and Loki to a private interface or protect them with a reverse proxy in production.

---

## Enabling TLS for TURN (optional, later)

For strict corporate networks, add **TLS (port 5349)**:

1) Prepare cert and key on host and mount into the container.  
2) Update `turnserver.conf`:
```ini
tls-listening-port=5349
cert=/etc/ssl/your_cert.crt
pkey=/etc/ssl/your_key.key
# remove: no-tls / no-dtls
```
3) Open **5349/tcp** on firewall.  
4) Add a `turns:` URL for clients:
```
turns:turn.yourdomain.com:5349
```

---

## Observability details

- **coturn → file log**: `coturn/logs/turn.log`  
- **promtail** reads `turn.log` and pushes to **Loki** (`http://loki:3100/loki/api/v1/push`).  
- **Grafana** is pre-provisioned with a Loki datasource and the “coturn logs” dashboard.

**If you see no logs in Grafana:**
- Ensure `turn.log` exists and is growing (`tail -f logs/turn.log`).  
- In **Grafana → Explore**, use query `{job="coturn"}`.  
- Check container logs for promtail and loki.  
- If Grafana’s datasource points to `http://coturn-loki:3100` but your service is named `loki`, change the datasource URL to `http://loki:3100` and restart Grafana:
  ```bash
  docker compose restart grafana
  ```

**LogQL examples (Grafana → Explore):**
- All lines: `{job="coturn"}`
- Errors only: `{job="coturn"} |= "ERROR"`
- Lines per 5 minutes: `sum(count_over_time({job="coturn"}[5m]))`

---

## Common operations

- **Start / Stop / Rebuild**
  ```bash
  docker compose up -d --build
  docker compose down
  docker compose restart coturn
  ```

- **Tail host log**
  ```bash
  tail -f logs/turn.log
  ```

- **Container logs**
  ```bash
  docker logs -f coturn
  docker logs -f coturn-promtail
  docker logs -f coturn-loki
  docker logs -f coturn-grafana
  ```

- **Change TURN credentials**
  1) Edit `turnserver.conf` (`user=NEWUSER:NEWLONGPASSWORD`).
  2) `docker compose restart coturn`
  3) Update your clients’ ICE `username` / `credential`.

---

## Security checklist (production)

- [ ] Use a **real domain** for `realm`.  
- [ ] Replace `user=` with strong, long secrets; rotate periodically.  
- [ ] Restrict open ports at the cloud firewall to only what you need.  
- [ ] Consider **TLS (5349)** for TURN.  
- [ ] Protect Grafana with a non-default admin password; optionally expose only internally.  
- [ ] Monitor `logs/turn.log` for auth failures / abuse.

---

## Troubleshooting quick tips

- **Clients can’t connect via TURN**
  - Wrong `external-ip` or blocked ports (3478 UDP/TCP, 49160–49200 UDP).
  - Bad credentials or wrong `realm` (auth failure appears in `turn.log`).
- **Works locally but not across networks**
  - Use TCP transport fallback in ICE servers:
    ```
    turn:YOUR_IP:3478?transport=tcp
    ```
  - For restrictive environments, enable TLS 5349.
- **No logs in Grafana**
  - Confirm promtail can read `/var/log/turnserver/turn.log`.
  - Ensure Loki is reachable from Grafana (datasource URL correct).

---

## About `reset_and_up.sh`

This helper stops Docker services system-wide, kills containers/processes, removes **all** Docker images/volumes/networks, recreates expected folders, and brings this stack up.  
Use **only if you know you want a clean slate globally**.  
Otherwise prefer:
```bash
docker compose down
docker compose up -d --build
```

---

## Port reference

- **3478/udp, 3478/tcp** — TURN/STUN  
- **49160–49200/udp** — TURN relay range  
- **3100/tcp** — Loki API (local)  
- **3000/tcp** — Grafana UI (local)

---

## License & components

- **coturn** (BSD), **Loki/Promtail/Grafana** (AGPL/Apache 2.0 / etc. per upstream)  
- This stack is fully open-source and self-hosted. Use, modify, and deploy freely.