# Database Backup & Restore Scripts

## Setup

Before using, update the RDS endpoint in both scripts:

**database_backup.sh (line 18):**
```bash
PROD_HOST="your-rds-endpoint.region.rds.amazonaws.com"
```

**database_restore.sh (line 15):**
```bash
PROD_HOST="your-rds-endpoint.region.rds.amazonaws.com"
```

---

## Backup Database

```bash
# Backup dev database (local)
DB_PASSWORD=yourpassword ./database_backup.sh dev

# Backup prod database (RDS)
DB_PASSWORD=yourpassword ./database_backup.sh prod

# Let it prompt for password
./database_backup.sh dev
```

Backups are saved to `./backups/` folder with timestamps:
- `dev_backup_20260216_143052.sql`
- `prod_backup_20260216_143052.sql`

---

## Restore Database

```bash
# Restore to dev database
DB_PASSWORD=yourpassword ./database_restore.sh dev ./backups/dev_backup_20260216_143052.sql

# Restore to prod database
DB_PASSWORD=yourpassword ./database_restore.sh prod ./backups/dev_backup_20260216_143052.sql
```

**Safety confirmations:**
- Dev restore: type `y` to confirm
- Prod restore: type `yes-restore-prod` to confirm

---

## Common Workflows

### Replace Production with Dev Data

```bash
# 1. Backup prod first (safety)
DB_PASSWORD=prodpass ./database_backup.sh prod

# 2. Backup dev
DB_PASSWORD=devpass ./database_backup.sh dev

# 3. Restore dev backup to prod
DB_PASSWORD=prodpass ./database_restore.sh prod ./backups/dev_backup_XXXXXX.sql
```

### Clone Production to Dev (for testing)

```bash
# 1. Backup prod
DB_PASSWORD=prodpass ./database_backup.sh prod

# 2. Restore prod backup to dev
DB_PASSWORD=devpass ./database_restore.sh dev ./backups/prod_backup_XXXXXX.sql
```

### Daily Backup Routine

```bash
# Run this daily via cron or manually
DB_PASSWORD=prodpass ./database_backup.sh prod
```

---

## Troubleshooting

### Permission denied
```bash
chmod +x database_backup.sh database_restore.sh
```

### Connection refused (RDS)
- Check RDS Security Group allows your IP
- Verify RDS endpoint is correct
- Ensure database is publicly accessible (or use VPN/bastion)

### Password authentication failed
- Verify password is correct
- Check username matches RDS master user
