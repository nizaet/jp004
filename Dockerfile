# Container for JP004 browser + its original Flask price proxy.
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt 'gunicorn>=22,<24'
COPY . .
# Import the original app, with an allowlist restricting public static files.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 4 --timeout 120 cloudrun_app:application"]
