FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
ENV PYTHONPATH=/app/src

# Cache the Silero VAD + turn detector weights into the image
RUN python -m sitering_agent.agent download-files || true

CMD ["python", "-m", "sitering_agent.agent", "start"]
