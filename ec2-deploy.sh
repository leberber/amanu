#!/bin/bash

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Configuration
BACKEND_IMAGE="backend"
FRONTEND_IMAGE="frontend"
BACKEND_TAR="backend.tar.gz"
FRONTEND_TAR="frontend.tar.gz"
DOCKER_COMPOSE_FILE="docker-compose.yml"

# ============================================================================
#                                 VISUAL FUNCTIONS 
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
#                             CORE DEPLOYMENT FUNCTIONS 
# ============================================================================

stop_containers() {
    print_step "Stopping all running containers..."
    sudo docker stop $(sudo docker ps -q) 2>/dev/null || true
    print_success "Containers stopped"
}

stop_compose() {
    if [ -f $DOCKER_COMPOSE_FILE ]; then
        print_step "Stopping docker-compose containers..."
        sudo docker-compose down
        print_success "Docker-compose stopped"
    fi
}

remove_old_containers() {
    print_step "Removing containers using project images..."
    sudo docker rm $(sudo docker ps -aq --filter ancestor=$BACKEND_IMAGE:latest) 2>/dev/null || true
    sudo docker rm $(sudo docker ps -aq --filter ancestor=$FRONTEND_IMAGE:latest) 2>/dev/null || true
    print_success "Old containers removed"
}

load_images() {
    print_step "Loading backend image..."
    sudo docker load < $BACKEND_TAR
    print_success "Backend image loaded"
    
    print_step "Loading frontend image..."
    sudo docker load < $FRONTEND_TAR
    print_success "Frontend image loaded"
}

verify_images() {
    print_step "Verifying images:"
    sudo docker images | grep -E "($BACKEND_IMAGE|$FRONTEND_IMAGE)"
    print_success "Images verified"
}

start_services() {
    print_step "Starting containers..."
    sudo docker-compose up -d
    print_success "Containers started"
}

check_status() {
    print_step "Container status:"
    sudo docker-compose ps
    
    # Check if any containers failed
    if ! sudo docker-compose ps | grep -q "Up"; then
        print_warning "Some containers may have issues. Checking logs:"
        sudo docker-compose logs --tail=20
    else
        print_success "All containers running healthy"
    fi
}

cleanup_files() {
    print_step "Cleaning up temporary files..."
    rm -f $BACKEND_TAR $FRONTEND_TAR
    print_success "Cleanup completed"
}

# ============================================================================
# MAIN EXECUTION 
# ============================================================================

main() {
    print_header "🐳 EC2 DEPLOYMENT AUTOMATION"
    
    # Core deployment steps
    stop_containers
    stop_compose  
    remove_old_containers
    load_images
    verify_images
    start_services
    check_status
    cleanup_files
    
    # Success message
    print_header "🎉 DEPLOYMENT COMPLETED!"
    echo -e "${GREEN}┌──────────────────────────────────────┐${NC}"
    echo -e "${GREEN}│${NC} ✅ All services running successfully ${GREEN}│${NC}"
    echo -e "${GREEN}│${NC} ✅ Temporary files cleaned          ${GREEN}│${NC}"
    echo -e "${GREEN}└──────────────────────────────────────┘${NC}"
    
    print_info "Deployment completed at $(date)"
}

# Error handling
trap 'print_error "Deployment failed! Check the output above."; exit 1' ERR

# Run deployment
main "$@"