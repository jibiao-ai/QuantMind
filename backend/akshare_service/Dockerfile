FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for mootdx
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple \
    akshare>=1.12.0 \
    pandas>=1.5.0 \
    mootdx>=0.11.0

# Copy application code
COPY main.py .

# Expose port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:9090/health')" || exit 1

# Run the service
CMD ["python3", "main.py"]
