FROM python:3.12-alpine

WORKDIR /app

# bash for runbooks, build deps for bcrypt/Pillow (qrcode)
RUN apk add --no-cache bash && \
    apk add --no-cache --virtual .build-deps gcc musl-dev libffi-dev jpeg-dev zlib-dev

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    apk del .build-deps

# Copy runner as a package into /app/runner/
COPY . /app/runner/

# Copy runbooks to expected location
COPY runbooks/ /app/runbooks/

# Data directory for auth.json
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "runner.main:app", "--host", "0.0.0.0", "--port", "8000"]
