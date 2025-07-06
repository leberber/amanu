#!/bin/bash

set -e

# Configuration variables
EC2_IP="35.181.57.216"
SSH_KEY="/Users/yazidmekhtoub/.ssh/Elsuq-ssh-key.pem"
EC2_USER="ec2-user"
DOMAIN="elsuq.org"

# Directories and files
FRONTEND_DIR="frontend"
BACKEND_DIR="backend"
BACKEND_IMAGE="backend"
FRONTEND_IMAGE="frontend"
BACKEND_TAR="backend.tar.gz"
FRONTEND_TAR="frontend.tar.gz"
DOCKER_COMPOSE_FILE="docker-compose.ec2.yml"
EC2_DEPLOY_SCRIPT="ec2-deploy.sh"


# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'


# ============================================================================
# VISUAL FUNCTIONS 
# ============================================================================

print_header() {
    echo -e "\n${PURPLE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}  $1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════${NC}\n"
}

print_step() { echo -e "${BLUE}▶${NC} ${WHITE}$1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }

# ============================================================================
# CORE DEPLOYMENT FUNCTIONS 
# ============================================================================

build_frontend() {
    print_step "Building Angular frontend..."
    cd $FRONTEND_DIR
    rm -rf dist/
    # Build for production
    npm run build -- --configuration=production --optimization 

    cd ..
    print_success "Angular build completed"
}

build_backend_image() {
    print_step "Building backend Docker image (AMD64)..."
    docker build --platform linux/amd64 -t $BACKEND_IMAGE $BACKEND_DIR/ --quiet
    print_success "Backend image built"
}

build_frontend_image() {
    print_step "Building frontend Docker image (AMD64)..."
    docker build --platform linux/amd64 -t $FRONTEND_IMAGE $FRONTEND_DIR/ --quiet
    print_success "Frontend image built"
}

save_images() {
    print_step "Saving and compressing Docker images..."
    docker save $BACKEND_IMAGE | gzip > $BACKEND_TAR
    docker save $FRONTEND_IMAGE | gzip > $FRONTEND_TAR
    
    local backend_size=$(du -h $BACKEND_TAR | cut -f1)
    local frontend_size=$(du -h $FRONTEND_TAR | cut -f1)
    print_success "Images saved (Backend: $backend_size, Frontend: $frontend_size)"
}

upload_files() {
    print_step "Uploading files to EC2..."
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no $BACKEND_TAR $EC2_USER@$EC2_IP:~/
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no $FRONTEND_TAR $EC2_USER@$EC2_IP:~/
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no $DOCKER_COMPOSE_FILE $EC2_USER@$EC2_IP:~/docker-compose.yml
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no $EC2_DEPLOY_SCRIPT $EC2_USER@$EC2_IP:~/
    print_success "All files uploaded"
}

deploy_on_ec2() {
    print_step "Executing deployment on EC2..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP "chmod +x $EC2_DEPLOY_SCRIPT && ./$EC2_DEPLOY_SCRIPT"
    print_success "Remote deployment completed"
}

cleanup_local() {
    print_step "Cleaning up local temporary files..."
    rm -f $BACKEND_TAR $FRONTEND_TAR
    print_success "Local cleanup completed"
}

# ============================================================================
# SIMPLE VALIDATION (Essential checks only)
# ============================================================================

basic_checks() {
    print_step "Running basic checks..."
    
    # Check essential directories exist
    [ ! -d "$FRONTEND_DIR" ] && { print_error "Frontend directory not found"; exit 1; }
    [ ! -d "$BACKEND_DIR" ] && { print_error "Backend directory not found"; exit 1; }
    
    # Check SSH key exists
    [ ! -f "$SSH_KEY" ] && { print_error "SSH key not found: $SSH_KEY"; exit 1; }
    
    # Check Docker is running
    docker info >/dev/null 2>&1 || { print_error "Docker is not running"; exit 1; }
    
    print_success "Basic checks passed"
}

# ============================================================================
# MAIN EXECUTION (Simple linear flow)
# ============================================================================

main() {
    print_header "🚀 EC2 DEPLOYMENT STARTED"
    print_info "Target: $EC2_USER@$EC2_IP"
    print_info "Domain: https://$DOMAIN"
    
    # Core deployment steps 
    basic_checks
    build_frontend
    build_backend_image
    build_frontend_image
    save_images
    upload_files
    deploy_on_ec2
    cleanup_local
    
    # Success message
    print_header "🎉 DEPLOYMENT SUCCESSFUL!"
    echo -e "${GREEN}┌─────────────────────────────────────────────┐${NC}"
    echo -e "${GREEN}│${NC} ${WHITE}Access your application:${NC}                 ${GREEN}│${NC}"
    echo -e "${GREEN}├─────────────────────────────────────────────┤${NC}"
    echo -e "${GREEN}│${NC} 🌐 Frontend: ${CYAN}https://$DOMAIN${NC}        ${GREEN}│${NC}"
    echo -e "${GREEN}│${NC} 🌐 Fallback: ${CYAN}http://$EC2_IP${NC}      ${GREEN}│${NC}"
    echo -e "${GREEN}│${NC} 📚 API Docs: ${CYAN}http://$EC2_IP:8000/docs${NC}  ${GREEN}│${NC}"
    echo -e "${GREEN}└─────────────────────────────────────────────┘${NC}"
    
    print_info "Deployment completed at $(date)"
    print_warning "Allow a few minutes for services to fully start"
}

# Error handling
trap 'print_error "Deployment failed! Check the output above."; rm -f $BACKEND_TAR $FRONTEND_TAR 2>/dev/null || true; exit 1' ERR

# Run deployment
main "$@"