# 📘 README — Self-Hosted STUN/TURN with Observability

This folder contains a **self-contained stack** to run a TURN/STUN relay server (`coturn`) with full observability powered by **Grafana Loki + Promtail + Grafana**.
Everything is open source, isolated, and deployable on Linux or cloud.

---

## 📂 Folder Structure

```
coturn/
├─ docker-compose.yml          # Orchestrates coturn + Loki + Promtail + Grafana
├─ Dockerfile                  # Builds coturn container
├─ turnserver.conf             # TURN/STUN configuration
├─ logs/                       # Host directory for coturn logs (mounted inside container)
├─ loki-config.yml             # Loki configuration (local storage)
├─ promtail-config.yml         # Promtail configuration (log shipper)
└─ grafana/
   ├─ provisioning/
   │  ├─ datasources/datasource.yml   # Preconfigures Loki datasource
   │  └─ dashboards/dashboards.yml    # Auto-loads dashboards
   └─ dashboards/coturn-logs.json     # Dashboard definition (logs explorer)
```

---

## 🚀 What This Stack Does

1. **coturn**

   * Provides **STUN** (discover public IP/port) and **TURN** (media relay when NAT/firewalls block P2P).
   * Logs connection attempts, allocations, authentication, and relayed traffic.
   * Writes logs into `./logs/turn.log`.

2. **Promtail**

   * Reads coturn log file.
   * Ships log lines to Loki.

3. **Loki**

   * Stores log entries in a time-series database optimized for logs.
   * Exposes a query API (`http://localhost:3100`).

4. **Grafana**

   * Provides a web UI (`http://localhost:3000`, login: `admin/admin`).
   * Preconfigured with Loki datasource.
   * Includes a ready-made **coturn logs** dashboard.
   * You can query, filter, and visualize logs.

---

## 🛠 Prerequisites

* Linux (tested on Ubuntu/Debian).
* Docker & Docker Compose installed.
* Open ports on your host/cloud firewall:

  * **3478 UDP/TCP** → coturn listening
  * **49160–49200 UDP** → relay range (must be open for media)
  * **3000 TCP** → Grafana UI (only needed for you, not clients)
  * **3100 TCP** → Loki API (internal, Grafana talks to it)

---

## ⚙️ TURN Configuration (`turnserver.conf`)

Key values in this file:

```ini
external-ip=150.107.191.52      # Replace with your public IP (run: curl ifconfig.me)
realm=pillustun.local           # Replace with your domain later, for now keep as-is
user=pillu:strongpassword123    # Username:password for clients (update to strong values)
log-file=/var/log/turnserver/turn.log
simple-log
```

* **external-ip** → your VPS’s public IPv4 address.
* **realm** → use your own domain if available; else a placeholder like `pillustun.local`.
* **user** → credentials your WebRTC clients will use.
* **log-file** → where logs are written (mapped to `./logs/turn.log`).

---

## 🔧 How to Run

### 1. Prepare

```bash
cd webrtc-stack/coturn
mkdir -p logs   # log directory on host
```

### 2. Start the stack

```bash
docker compose up -d --build
```

### 3. Verify services

```bash
docker ps
docker logs -f coturn      # view coturn logs live
docker logs -f promtail    # check log shipping
docker logs -f loki
docker logs -f grafana
```

### 4. Open Grafana

* URL: [http://localhost:3000](http://localhost:3000)
* User: `admin`
* Pass: `admin`

Dashboard → `coturn logs`.

---

## 🧪 Testing TURN/STUN

From your WebRTC client (browser or Python aiortc), configure ICE servers:

```json
{
  "iceServers": [
    { "urls": ["stun:150.107.191.52:3478"] },
    {
      "urls": ["turn:150.107.191.52:3478?transport=udp"],
      "username": "pillu",
      "credential": "strongpassword123"
    },
    {
      "urls": ["turn:150.107.191.52:3478?transport=tcp"],
      "username": "pillu",
      "credential": "strongpassword123"
    }
  ]
}
```

---

## 📊 Observability in Grafana

Once traffic flows:

* **Log stream panel** → shows real-time coturn logs.
* **Explore tab** → query with Loki’s LogQL (e.g., `{job="coturn"}` or regex match).
* **Metrics panels** (optional) → count log lines per time window.

---

## 📉 Resource Usage

* **coturn** → \~50 MB RAM idle.
* **Loki + Promtail + Grafana** → 350–550 MB RAM idle combined.
* Safe to run on a small VM (1 vCPU, 1–2 GB RAM).

---

## 🌍 Moving to Cloud

1. Set `external-ip` in `turnserver.conf` to your VPS public IP.
2. If you own a domain → set `realm=yourdomain.com`.
3. Open firewall for:

   * UDP/TCP 3478
   * UDP 49160–49200
   * TCP 3000 (Grafana UI)
4. Restart stack:

   ```bash
   docker compose down
   docker compose up -d --build
   ```

---

## 🔒 Security Recommendations

* Change the default `user` to long random credentials.
* Do not expose Grafana publicly without password change.
* For stricter networks: enable TLS for TURN (port 5349) with `cert`/`pkey` in `turnserver.conf`.
* Add HTTPS/TLS to Grafana and Loki with reverse proxy (Nginx/Traefik) if exposed externally.

---

## 📚 References

* [Coturn GitHub](https://github.com/coturn/coturn)
* [Grafana Loki](https://grafana.com/oss/loki/)
* [Promtail](https://grafana.com/docs/loki/latest/clients/promtail/)
* [Grafana](https://grafana.com/oss/grafana/)
* [WebRTC ICE Servers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer)

---

✅ With this setup you now have:

* A **production-ready STUN/TURN relay**
* Persistent **logs shipped to Loki**
* **Grafana dashboard** for observability
