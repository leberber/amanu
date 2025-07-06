# Infrastructure Setup

This directory contains AWS CDK infrastructure code and deployment scripts for the FastAPI + Angular application.

## Files Overview

- **`app.py`** - CDK application entry point

- **`ec2_stack.py`** - Main CDK stack definition (EC2, Route53, Security Groups)
- **`cdk.json`** - CDK configuration
- **`cdk.context.json`** - CDK context cache (auto-generated)
- **`ec2-setup.sh`** - Server configuration script (runs on EC2)
- **`setup-instance.sh`** - Local script to deploy and configure the instance
- **`cdk.out/`** - CDK synthesized templates (auto-generated)

## Prerequisites

0. **Domain name** registered and hosted zone created in Route53

1. **AWS CLI installed and configured**:

   ```bash
   # Install AWS CLI (if not installed)
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /

   # Configure AWS credentials
   aws configure
   # Enter your:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region (e.g., eu-west-3)
   # - Default output format (json)
   ```

2. **AWS CDK installed**: `npm install -g aws-cdk`
3. **Python dependencies**: `pip install aws-cdk-lib constructs`
4. **SSH key pair**: `Elsuq-ssh-key` must exist in your AWS account

## Quick Start

### 1. Create SSH Key Pair

```bash
# Create AWS key pair
aws ec2 create-key-pair \
    --key-name Elsuq-ssh-key \
    --query 'KeyMaterial' \
    --output text > ~/.ssh/Elsuq-ssh-key.pem

# Set permissions
chmod 400 ~/.ssh/Elsuq-ssh-key.pem
```

### 2. Deploy Infrastructure

```bash
cd infra
cdk bootstrap  # First time only
cdk deploy
```

### 3. Configure Server

```bash
# Update the EC2_IP in setup-instance.sh with the output from step 2
# Then run:
./setup-instance.sh
```

**Important Configuration**: Before running, update these variables in your scripts:

- **`setup-instance.sh`**: Update `EC2_IP` with your instance's public IP
- **`ec2-setup.sh`**: Update `DOMAIN_NAME` and `EMAIL` if using a different domain
  ```bash
  DOMAIN_NAME="domain.com"     # Change this to your domain
  EMAIL="example@gmail.com" # Change this to your email
  ```

## What Gets Created

### AWS Resources

- **EC2 Instance** (t3.small) with Amazon Linux 2023
- **Security Group** with ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 4200 (Angular), 8000 (FastAPI)
- **Route53 Records** for `example.com` and `www.example.com`
- **IAM Role** for the EC2 instance

### Server Configuration

- **Docker & Docker Compose** installed
- **Nginx** configured as reverse proxy
- **SSL certificates** via Let's Encrypt/Certbot
- **Automatic HTTPS redirect**

## Configuration Variables

### Domain Setup

The domain is configured in multiple places:

1. **CDK Stack** (`app.py`):

   ```python
   Ec2ProjectStack(app, "MyEc2ProjectStack",
       domain_name="example.com",  # Main domain configuration
   ```

2. **Setup Script** (`ec2-setup.sh`):

   ```bash
   DOMAIN_NAME="example.com"        # Domain for SSL certificate
   EMAIL="example@gmail.com"    # Email for Let's Encrypt
   ```

3. **Instance Script** (`setup-instance.sh`):
   ```bash
   EC2_IP="35.181.57.216"  # Update with your EC2 public IP
   ```

**To use a different domain**: Update all three locations with your domain name.

### `ec2-setup.sh`

Runs ON the EC2 instance to configure:

- Nginx reverse proxy (port 80 → 4200 for frontend, /api → 8000 for backend)
- SSL certificates for HTTPS
- Automatic certificate renewal

### `setup-instance.sh`

Runs FROM your local machine to:

- Copy the setup script to EC2
- Execute the setup script via SSH
- Handle the deployment process

## DNS Configuration

The stack automatically creates:

- `example.com` → EC2 public IP
- `www.example.com` → EC2 public IP

**Important**: Wait 1-5 minutes for DNS propagation before running SSL setup.

## Deployment Flow

1. **Infrastructure**: `cdk deploy` creates AWS resources
2. **Application**: Deploy your Docker containers to EC2
3. **Configuration**: Run setup scripts for nginx and SSL
4. **Verification**: Check `https://example.com`

## Useful Commands

```bash
# View stack outputs
cdk deploy --outputs-file outputs.json

# SSH into instance
ssh -i ~/.ssh/Elsuq-ssh-key.pem ec2-user@<PUBLIC_IP>

# Check deployment status
cdk list
cdk diff

# Destroy everything
cdk destroy
```

## Troubleshooting

### DNS Issues

```bash
# Check if DNS has propagated
dig example.com +short
nslookup example.com
```

### SSL Certificate Issues

```bash
# On EC2 instance, check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Test certificate renewal
sudo certbot renew --dry-run
```

### Application Issues

```bash
# Check Docker containers on EC2
docker ps
docker-compose logs
```

## Security Notes

- SSH key is required for instance access
- Security group restricts access to necessary ports only
- SSL certificates are automatically renewed via cron
- All HTTP traffic redirects to HTTPS

## Cost Estimation

- **EC2 t3.small**: ~$15-20/month
- **Route53 hosted zone**: $0.50/month
- **Data transfer**: Minimal for development use
- **Total**: ~$16-21/month

---

**Next**: See the [main README](../README.md) for application deployment instructions.
