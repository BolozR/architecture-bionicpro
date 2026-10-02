FROM golang:1.24.2-bookworm AS build
RUN CGO_ENABLED=0 go install github.com/minio/minio@RELEASE.2025-04-22T22-12-26Z

FROM debian:bookworm-slim
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /go/bin/minio /usr/local/bin/minio
ENTRYPOINT ["minio"]
