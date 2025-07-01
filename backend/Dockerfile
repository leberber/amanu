FROM python:3.11-slim

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir \
    fastapi>=0.109.0 \
    uvicorn>=0.27.0 \
    sqlmodel>=0.0.14 \
    pydantic>=2.6.0 \
    python-jose>=3.3.0 \
    passlib>=1.7.4 \
    python-multipart>=0.0.7 \
    python-dotenv>=1.0.1 \
    email-validator>=2.1.0 \
    bcrypt>=4.1.2 \
    pydantic-settings>=2.0.0

# Copy the rest of the application
COPY . .

# Create a non-root user to run the app
RUN adduser --disabled-password --gecos "" appuser
# Make sure appuser can write to the database directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

# Expose the port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]