# Monitoring & Logs Guide

This guide covers how to monitor your application and view logs.

## Quick Access (SSH)

```bash
# SSH into EC2
ssh -i ~/.ssh/Elsuq-ssh-key.pem ec2-user@35.181.57.216
```

## Viewing Docker Logs

### Backend Logs (FastAPI)

```bash
# Live logs (follow mode)
sudo docker logs -f ec2-user-backend-1

# Last 100 lines
sudo docker logs --tail 100 ec2-user-backend-1

# Logs from last hour
sudo docker logs --since 1h ec2-user-backend-1

# Search for errors
sudo docker logs ec2-user-backend-1 2>&1 | grep -i error
```

### Frontend Logs (Nginx)

```bash
# Live logs
sudo docker logs -f ec2-user-frontend-1

# Last 50 lines
sudo docker logs --tail 50 ec2-user-frontend-1
```

### All Services

```bash
# View all with docker-compose
sudo docker-compose logs

# Follow all logs
sudo docker-compose logs -f

# Specific service
sudo docker-compose logs -f backend
sudo docker-compose logs -f frontend
```

## Container Status

```bash
# Running containers
sudo docker ps

# Container resource usage (CPU, memory)
sudo docker stats

# Container details
sudo docker inspect ec2-user-backend-1
```

## System Logs

```bash
# System journal (all services)
sudo journalctl -f

# Docker daemon logs
sudo journalctl -u docker -f

# Last boot logs
sudo journalctl -b
```

## Disk Space Monitoring

```bash
# Overall disk usage
df -h

# Docker disk usage
sudo docker system df

# Find large files
sudo du -sh /* 2>/dev/null | sort -hr | head -10
```

## Cleanup Commands

```bash
# Remove unused Docker images
sudo docker image prune -f

# Remove all unused Docker data (images, containers, volumes)
sudo docker system prune -a -f

# Clean old system logs (keep last 100MB)
sudo journalctl --vacuum-size=100M
```

---

## Monitoring Options (Future)

### Option 1: Admin Logs Endpoint (Simple)

Add a backend API endpoint that returns recent logs, viewable in admin panel.

**Pros:**
- Easy to implement
- No external services
- Free

**Cons:**
- Only works when backend is running
- Limited search capability

### Option 2: AWS CloudWatch (Recommended)

Send Docker logs to AWS CloudWatch automatically.

**Setup:**
1. Install CloudWatch agent on EC2
2. Configure log groups for backend/frontend
3. View logs in AWS Console

**Pros:**
- Works even if app crashes
- Searchable
- Can set up alerts
- Integrates with AWS

**Cons:**
- Small cost (~$0.50/GB ingested)
- AWS configuration required

### Option 3: Grafana + Loki (Advanced)

Full monitoring stack with dashboards.

**Components:**
- Loki: Log aggregation
- Grafana: Visualization
- Promtail: Log collector

**Pros:**
- Professional dashboards
- Metrics + logs together
- Alerts and notifications
- Open source

**Cons:**
- More complex setup
- Needs additional resources
- Maintenance overhead

---

## Useful Aliases

Add these to `~/.bashrc` on EC2 for quick access:

```bash
# Add to ~/.bashrc
alias logs-backend='sudo docker logs -f ec2-user-backend-1'
alias logs-frontend='sudo docker logs -f ec2-user-frontend-1'
alias logs-all='sudo docker-compose logs -f'
alias dps='sudo docker ps'
alias dstats='sudo docker stats'
```

Then run `source ~/.bashrc` to apply.

---

## Health Check Endpoints

- **Backend API Docs:** http://35.181.57.216:8000/docs
- **Frontend:** https://agroclik.com

## Emergency Commands

```bash
# Restart all services
sudo docker-compose restart

# Restart specific service
sudo docker-compose restart backend

# Force recreate containers
sudo docker-compose up -d --force-recreate

# View why a container crashed
sudo docker logs --tail 50 ec2-user-backend-1
```
