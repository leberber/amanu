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

save_previous_images() {
    print_step "Saving current images as :previous (for rollback)..."
    sudo docker tag $BACKEND_IMAGE:latest $BACKEND_IMAGE:previous 2>/dev/null || true
    sudo docker tag $FRONTEND_IMAGE:latest $FRONTEND_IMAGE:previous 2>/dev/null || true
    print_success "Previous images saved"
}

load_images() {
    print_step "Loading backend image..."
    sudo docker load < $BACKEND_TAR
    print_success "Backend image loaded"

    print_step "Loading frontend image..."
    sudo docker load < $FRONTEND_TAR
    print_success "Frontend image loaded"
}

cleanup_old_images() {
    print_step "Cleaning up dangling images..."
    sudo docker image prune -f
    print_success "Old images cleaned up"
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

health_check() {
    print_step "Running health checks..."

    # Wait for services to start
    sleep 10

    # Check backend
    if curl -sf http://localhost:8000/docs > /dev/null 2>&1; then
        print_success "Backend is healthy"
        BACKEND_HEALTHY=true
    else
        print_error "Backend health check failed"
        BACKEND_HEALTHY=false
    fi

    # Check frontend
    if curl -sf http://localhost:80 > /dev/null 2>&1; then
        print_success "Frontend is healthy"
        FRONTEND_HEALTHY=true
    else
        print_error "Frontend health check failed"
        FRONTEND_HEALTHY=false
    fi

    # Return status
    if [ "$BACKEND_HEALTHY" = true ] && [ "$FRONTEND_HEALTHY" = true ]; then
        return 0
    else
        return 1
    fi
}

rollback() {
    print_warning "Initiating rollback to previous version..."

    # Check if previous images exist
    if ! sudo docker image inspect $BACKEND_IMAGE:previous > /dev/null 2>&1; then
        print_error "No previous backend image found - cannot rollback"
        return 1
    fi

    if ! sudo docker image inspect $FRONTEND_IMAGE:previous > /dev/null 2>&1; then
        print_error "No previous frontend image found - cannot rollback"
        return 1
    fi

    # Stop current containers
    sudo docker-compose down

    # Restore previous images as latest
    sudo docker tag $BACKEND_IMAGE:previous $BACKEND_IMAGE:latest
    sudo docker tag $FRONTEND_IMAGE:previous $FRONTEND_IMAGE:latest

    # Restart with previous images
    sudo docker-compose up -d

    print_warning "Rollback completed - running previous version"
    print_warning "Check logs to investigate the failed deployment"
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
    save_previous_images      # Save current as :previous for rollback
    load_images
    cleanup_old_images        # Remove dangling images to free space
    verify_images
    start_services
    check_status
    cleanup_files

    # Health check with automatic rollback
    if health_check; then
        print_header "🎉 DEPLOYMENT SUCCESSFUL!"
        echo -e "${GREEN}┌──────────────────────────────────────┐${NC}"
        echo -e "${GREEN}│${NC} ✅ All services running successfully ${GREEN}│${NC}"
        echo -e "${GREEN}│${NC} ✅ Health checks passed             ${GREEN}│${NC}"
        echo -e "${GREEN}│${NC} ✅ Previous version saved           ${GREEN}│${NC}"
        echo -e "${GREEN}└──────────────────────────────────────┘${NC}"
        print_info "Deployment completed at $(date)"
    else
        print_header "⚠️  DEPLOYMENT FAILED - ROLLING BACK"
        rollback
        print_error "Deployment failed! Reverted to previous version."
        print_error "Check your code and try again."
        exit 1
    fi
}

# Error handling
trap 'print_error "Deployment failed! Check the output above."; exit 1' ERR

# Run deployment
main "$@"