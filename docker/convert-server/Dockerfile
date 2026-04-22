# =============================================
# docker/convert-server/Dockerfile
# =============================================
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성
# LibreOffice는 HWP 변환이 필요한 경우에만 포함 (~700MB 증가)
# 불필요하면 아래 libreoffice 줄 제거 → 이미지 ~200MB
RUN apt-get update && apt-get install -y \
    libreoffice \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 (playwright 포함)
COPY requirements.txt .
RUN pip install --no-cache-dir flask python-docx openpyxl pdfplumber anthropic pdf2image Pillow playwright

# Playwright Chromium + 시스템 의존성 설치 (~400MB — full-page 스크린샷용)
RUN playwright install --with-deps chromium

# 앱 복사
COPY convert-server.py .

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8082/health || exit 1

CMD ["python", "convert-server.py"]