# EC2 Production Environment Setup

## Setting Environment Variables on EC2

After your first deployment or when you need to update environment variables, SSH into your EC2 instance and follow these steps:

### Step 1: SSH into EC2

```bash
ssh -i ~/.ssh/Elsuq-ssh-key.pem ec2-user@35.181.57.216
```

### Step 2: Create Environment File

Create a `.env` file in your home directory:

```bash
nano ~/.env
```

### Step 3: Add Your Production Environment Variables

Paste the following and update with your actual production values:

```env
# Production Database (AWS RDS)
DATABASE_URL=postgresql://elsuq:ValidPass2025@elsuq.c94sm0q46x5u.us-east-2.rds.amazonaws.com:5432/elsuq

# Production Secret Key (Generate a secure random key)
SECRET_KEY=your-production-secret-key-here

# Admin Configuration
ADMIN_EMAIL=admin@elsuqhub.com
ADMIN_PASSWORD=your-secure-admin-password
ADMIN_NAME=Admin User
```

**Important:** Generate a strong SECRET_KEY for production! You can use:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 4: Load Environment Variables

Add this line to your `~/.bashrc` or `~/.bash_profile`:

```bash
echo 'export $(cat ~/.env | xargs)' >> ~/.bashrc
source ~/.bashrc
```

### Step 5: Verify Environment Variables

Check that they're loaded:

```bash
echo $DATABASE_URL
echo $SECRET_KEY
```

### Step 6: Restart Services

After setting environment variables, restart your Docker containers:

```bash
cd ~
sudo docker-compose down
sudo docker-compose up -d
```

### Step 7: Verify Services Are Running

```bash
sudo docker-compose ps
sudo docker-compose logs backend | tail -20
```

## How It Works

- **Local Development**: Uses `backend/.env` file with local PostgreSQL
- **Production (EC2)**: Uses environment variables set on the EC2 instance
- **No more manual switching**: Deploy script automatically handles everything

## Important Notes

1. ✅ The `.env` file is in `.gitignore` - your local credentials will never be committed
2. ✅ Production credentials are set on EC2 server only - never in code
3. ✅ When you run `./deploy.sh`, it will use production environment variables from EC2
4. ✅ No need to comment/uncomment database URLs anymore!

## Troubleshooting

If the backend can't connect to the database after deployment:

1. Check environment variables are set:
   ```bash
   ssh -i ~/.ssh/Elsuq-ssh-key.pem ec2-user@35.181.57.216
   echo $DATABASE_URL
   ```

2. Check Docker can access them:
   ```bash
   sudo docker exec -it <container-name> env | grep DATABASE_URL
   ```

3. Check backend logs:
   ```bash
   sudo docker-compose logs backend
   ```
