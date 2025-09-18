FROM alpine:3.20

RUN apk add --no-cache coturn

RUN mkdir -p /var/log/turnserver && chown -R root:root /var/log/turnserver

COPY turnserver.conf /etc/turnserver.conf

EXPOSE 3478/udp
EXPOSE 3478/tcp

CMD ["/usr/bin/turnserver", "-c", "/etc/turnserver.conf", "-v"]
