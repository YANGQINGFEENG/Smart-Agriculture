FROM docker.1ms.run/library/python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY app.py .

RUN mkdir -p /app/uploads

EXPOSE 5000

ENV MODEL_PATH=/app/models/yolov5n.pt

CMD ["python", "app.py"]
