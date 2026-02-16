#!/bin/bash

# Database Restore Script for Amanu
# Usage: ./database_restore.sh [dev|prod] <backup_file>

set -e

# Configuration
PSQL="/opt/homebrew/opt/postgresql@17/bin/psql"

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

restore_database() {
    local ENV=$1
    local HOST=$2
    local PORT=$3
    local USER=$4
    local DB=$5
    local BACKUP_FILE=$6

    echo "================================================"
    echo "Restoring $ENV database..."
    echo "Host: $HOST"
    echo "Database: $DB"
    echo "From file: $BACKUP_FILE"
    echo "================================================"

    PGPASSWORD="$DB_PASSWORD" "$PSQL" \
        -h "$HOST" \
        -p "$PORT" \
        -U "$USER" \
        -d "$DB" \
        -f "$BACKUP_FILE"

    echo ""
    echo "Restore completed successfully!"
}

# Check for arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./database_restore.sh [dev|prod] <backup_file>"
    echo ""
    echo "Examples:"
    echo "  DB_PASSWORD=mypassword ./database_restore.sh dev ./backups/dev_backup_20260216.sql"
    echo "  DB_PASSWORD=mypassword ./database_restore.sh prod ./backups/dev_backup_20260216.sql"
    exit 1
fi

BACKUP_FILE="$2"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
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
        echo ""
        echo "WARNING: This will overwrite the DEV database!"
        read -p "Are you sure? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo "Aborted."
            exit 0
        fi
        restore_database "dev" "$DEV_HOST" "$DEV_PORT" "$DEV_USER" "$DEV_DB" "$BACKUP_FILE"
        ;;
    prod)
        echo ""
        echo "!!! DANGER: This will overwrite the PRODUCTION database !!!"
        echo "File to restore: $BACKUP_FILE"
        echo ""
        read -p "Type 'yes-restore-prod' to confirm: " confirm
        if [ "$confirm" != "yes-restore-prod" ]; then
            echo "Aborted."
            exit 0
        fi
        restore_database "prod" "$PROD_HOST" "$PROD_PORT" "$PROD_USER" "$PROD_DB" "$BACKUP_FILE"
        ;;
    *)
        echo "Invalid option: $1"
        echo "Use 'dev' or 'prod'"
        exit 1
        ;;
esac
