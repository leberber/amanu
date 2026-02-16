#!/bin/bash

# Database Backup Script for Amanu
# Usage: ./database_backup.sh [dev|prod]

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PG_DUMP="/opt/homebrew/opt/postgresql@17/bin/pg_dump"

# Dev Database (Local)
DEV_HOST="localhost"
DEV_PORT="5432"
DEV_USER="postgres"
DEV_DB="elsuq"

# Production Database (RDS)
PROD_HOST="elsuq.c94sm0q46x5u.us-east-2.rds.amazonaws.com"
PROD_PORT="5432"
PROD_USER="elsuq"
PROD_DB="elsuq"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

backup_database() {
    local ENV=$1
    local HOST=$2
    local PORT=$3
    local USER=$4
    local DB=$5
    local BACKUP_FILE="$BACKUP_DIR/${ENV}_backup_${TIMESTAMP}.sql"

    echo "================================================"
    echo "Backing up $ENV database..."
    echo "Host: $HOST"
    echo "Database: $DB"
    echo "Output: $BACKUP_FILE"
    echo "================================================"

    PGPASSWORD="$DB_PASSWORD" "$PG_DUMP" \
        -h "$HOST" \
        -p "$PORT" \
        -U "$USER" \
        -d "$DB" \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        -f "$BACKUP_FILE"

    echo ""
    echo "Backup completed successfully!"
    echo "File: $BACKUP_FILE"
    echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
}

# Check for environment argument
if [ -z "$1" ]; then
    echo "Usage: ./database_backup.sh [dev|prod]"
    echo ""
    echo "Examples:"
    echo "  DB_PASSWORD=mypassword ./database_backup.sh dev"
    echo "  DB_PASSWORD=mypassword ./database_backup.sh prod"
    exit 1
fi

# Check for password
if [ -z "$DB_PASSWORD" ]; then
    echo -n "Enter database password: "
    read -s DB_PASSWORD
    echo ""
fi

case "$1" in
    dev)
        backup_database "dev" "$DEV_HOST" "$DEV_PORT" "$DEV_USER" "$DEV_DB"
        ;;
    prod)
        backup_database "prod" "$PROD_HOST" "$PROD_PORT" "$PROD_USER" "$PROD_DB"
        ;;
    *)
        echo "Invalid option: $1"
        echo "Use 'dev' or 'prod'"
        exit 1
        ;;
esac
