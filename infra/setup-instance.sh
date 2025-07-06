#!/bin/bash

# Simple setup-instance.sh - Copy and run setup on EC2

EC2_IP="35.181.57.216"  # Update this
SSH_KEY="/Users/yazidmekhtoub/.ssh/Elsuq-ssh-key.pem"

echo "Setting up $EC2_IP..."

# Copy and run setup script
scp -i "$SSH_KEY" ec2-setup.sh ec2-user@$EC2_IP:~/
ssh -i "$SSH_KEY" ec2-user@$EC2_IP "chmod +x ec2-setup.sh && ./ec2-setup.sh"

echo "✅ Done! Visit https://elsuq.org"
