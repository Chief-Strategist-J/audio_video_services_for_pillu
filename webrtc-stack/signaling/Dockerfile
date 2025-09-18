FROM python:3.11-slim

# Work directory
WORKDIR /app

# Install deps
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . /app

EXPOSE 8000

# Run FastAPI app with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
