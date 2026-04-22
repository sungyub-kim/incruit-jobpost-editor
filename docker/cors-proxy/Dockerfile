# =============================================
# docker/cors-proxy/Dockerfile
# =============================================
# (별도 파일로 저장: docker/cors-proxy/Dockerfile)

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

COPY cors-proxy.py .

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

CMD ["python", "cors-proxy.py"]