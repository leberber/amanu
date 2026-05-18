# Database Backup & Restore

Credentials are stored in `.env` (not committed to git).

## Backup

```bash
./backup.sh dev    # backup local database
./backup.sh prod   # backup production database
```

Files saved to `./backups/` as `.dump` files.

## Restore

```bash
./restore.sh dev ./backups/prod_backup_XXXXXXXX_XXXXXX.dump   # restore into dev
./restore.sh prod ./backups/prod_backup_XXXXXXXX_XXXXXX.dump  # restore into prod (requires confirmation)
```

## Typical workflow

```bash
./backup.sh prod                                              # 1. backup prod
./restore.sh dev ./backups/prod_backup_XXXXXXXX_XXXXXX.dump   # 2. restore into dev
```
