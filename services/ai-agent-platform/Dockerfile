FROM python:3.12-slim

# -----------------------------------------------------------------------------
# MailZen AI agent platform container.
# - Installs Python dependencies from requirements.txt
# - Serves FastAPI via uvicorn on port 8100
# -----------------------------------------------------------------------------

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY services/ai-agent-platform/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/ai-agent-platform/app ./app

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import sys, urllib.request; \
url='http://127.0.0.1:8100/health'; \
status=urllib.request.urlopen(url, timeout=3).getcode(); \
sys.exit(0 if 200 <= status < 400 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
