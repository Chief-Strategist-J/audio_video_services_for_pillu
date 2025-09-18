# 📘 README — Self-Hosted STUN/TURN with Observability

This folder (`webrtc-stack/coturn/`) contains a **self-contained stack** to run a TURN/STUN relay server (`coturn`) with observability powered by **Grafana Loki + Promtail + Grafana**.
All components are isolated inside this folder, making it easy to deploy locally or on cloud.

---

## 📂 Folder Structure

```
coturn/
├── docker-compose.yml            # Orchestrates coturn + Loki + Promtail + Grafana
├── Dockerfile                    # Builds coturn container
├── turnserver.conf               # TURN/STUN configuration
├── logs/                         # coturn writes logs here
│   ├── turn.log
│   ├── turn_1_2025-09-18.log
│   └── turnserver.pid
├── loki-config.yml               # Loki config
├── promtail-config.yml           # Promtail config
├── grafana/
│   ├── dashboards/
│   │   └── coturn-logs.json      # Dashboard definition
│   └── provisioning/
│       ├── dashboards/dashboards.yml
│       └── datasources/datasource.yml
└── Readme.md
```

---

## 🚀 What This Stack Does

* **coturn** → STUN/TURN relay server for WebRTC. Handles NAT traversal, authentication, and media relay. Logs events to `logs/turn.log`.
* **Promtail** → Reads coturn logs and ships them to Loki.
* **Loki** → Stores logs in a queryable time-series database.
* **Grafana** → UI for visualizing coturn logs in real time.

---

## 🛠 Prerequisites

* Linux (Ubuntu/Debian tested).
* Docker + Docker Compose installed.
* Open these ports on firewall/cloud:

  * UDP/TCP **3478** (coturn main port).
  * UDP **49160–49200** (relay ports).
  * TCP **3000** (Grafana UI).
  * TCP **3100** (Loki API, Grafana uses it internally).

---

## ⚙️ TURN Configuration (`turnserver.conf`)

Important values:

```ini
external-ip=150.107.191.52        # Your public IP (check: curl ifconfig.me)
realm=pillustun.local             # Replace with your domain if you get one
user=pillu:strongpassword123      # Username:password for clients
log-file=/var/log/turnserver/turn.log
```

* **external-ip** → VPS or server public IP.
* **realm** → placeholder now (`pillustun.local`), later replace with a domain.
* **user** → credentials your WebRTC clients will use.
* **log-file** → mapped to `./logs/turn.log` on host.

---

## 📡 ICE Server Config (for clients)

Use these values in browser or Python aiortc clients:

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

## 🔧 Running the Stack

1. Go into folder:

   ```bash
   cd webrtc-stack/coturn
   mkdir -p logs
   ```

2. Start services:

   ```bash
   docker compose up -d --build
   ```

3. Check containers:

   ```bash
   docker ps
   ```

   You should see:

   * `coturn`
   * `coturn-loki`
   * `coturn-promtail`
   * `coturn-grafana`

4. Check logs:

   ```bash
   docker logs -f coturn
   docker logs -f promtail
   docker logs -f coturn-loki
   docker logs -f coturn-grafana
   ```

---

## 📊 Grafana Observability

* Open Grafana → [http://localhost:3000](http://localhost:3000)
* Login: **admin / admin**
* The Loki datasource is already pre-provisioned (via `grafana/provisioning/datasources/datasource.yml`).
* Open dashboard: **coturn logs**.

If you still see *“Datasource Loki not found”*:

* Make sure the datasource file exists at
  `grafana/provisioning/datasources/datasource.yml`.
* Ensure it points to the **container name**:

  ```yaml
  url: http://coturn-loki:3100
  ```
* Restart Grafana:

  ```bash
  docker compose restart grafana
  ```

---

## 🧪 Queries in Grafana (LogQL)

Examples in Explore tab:

* Show all coturn logs:

  ```
  {job="coturn"}
  ```
* Count log lines per 5 minutes:

  ```
  sum(count_over_time({job="coturn"}[5m]))
  ```
* Filter only auth failures:

  ```
  {job="coturn"} |= "unauthorized"
  ```

---

## 📉 Resource Usage

* **coturn** → \~50 MB RAM.
* **Loki + Promtail + Grafana** → \~350–500 MB RAM idle.
* Runs fine on a small VM (1 vCPU, 1–2 GB RAM).

---

## 🔒 Security Tips

* Change `user=pillu:strongpassword123` to a strong secret before real usage.
* Do not expose Grafana publicly with default password.
* Use a domain + TLS for TURN (`5349`) if you need production-grade encryption.
* Limit Grafana + Loki ports to your own IP using firewall rules.

---

## 📚 References

* [Coturn GitHub](https://github.com/coturn/coturn)
* [Grafana Loki](https://grafana.com/oss/loki/)
* [Promtail](https://grafana.com/docs/loki/latest/clients/promtail/)
* [Grafana](https://grafana.com/oss/grafana/)
* [WebRTC ICE Servers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer)

---

✅ This stack now gives you a **self-hosted STUN/TURN relay** with full **log observability in Grafana**.
