FROM python:3.12-slim

RUN groupadd -r securewatch && useradd -r -g securewatch securewatch

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create the default upload directory expected by config.py (/data/uploads)
RUN mkdir -p /data/uploads && chown -R securewatch:securewatch /data /app

USER securewatch

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
