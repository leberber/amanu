# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amanu is a multi-language e-commerce platform for fresh produce (fruits and vegetables), branded as "Elsuq". It consists of a FastAPI backend and Angular frontend, deployed on AWS using Docker containers.

## Essential Commands

### Backend Development
```bash
cd backend
uvicorn main:app --reload  # Run the FastAPI server with hot reload
```

### Frontend Development
```bash
cd frontend
npm install    # Install dependencies
npm start      # Start development server on http://localhost:4200
npm run build  # Build for production
```

### Deployment
```bash
./deploy.sh    # Automated deployment to AWS EC2
```

The deployment script:
1. Builds Docker images for frontend and backend
2. Pushes to Docker Hub (yazidkheloufi/amanu-frontend and yazidkheloufi/amanu-backend)
3. SSHs to EC2 instance and updates containers
4. Handles SSL certificates via Let's Encrypt

## Architecture

### Backend (FastAPI)
- **Entry point**: `backend/main.py`
- **Database**: SQLModel ORM with PostgreSQL
- **Authentication**: JWT tokens with role-based access (Customer, Staff, Admin)
- **Key models**: User, Product, Order, Cart, Address
- **API Documentation**: Available at `/docs` when running

### Frontend (Angular)
- **Version**: Angular 20 with standalone components
- **UI Library**: PrimeNG components
- **Styling**: TailwindCSS
- **State Management**: Services with BehaviorSubjects
- **i18n**: @ngx-translate for English, French, and Arabic
- **PWA**: Progressive Web App with service worker

### Key Architectural Patterns

1. **Multi-language Support**: 
   - Products have translations stored in `product_translations` table
   - Frontend uses @ngx-translate with language files in `frontend/src/assets/i18n/`
   - Language preference stored in localStorage

2. **Authentication Flow**:
   - JWT tokens stored in localStorage
   - Auth interceptor adds token to requests
   - Role-based guards protect routes

3. **Shopping Cart**:
   - Server-side cart management for authenticated users
   - Frontend cart service syncs with backend

4. **Image Handling**:
   - Product images stored in `backend/product_images/`
   - Served as static files by FastAPI

## Infrastructure

- **AWS Resources**: EC2 instance, Elastic IP, Security Groups
- **Domain**: elsuq.com with Route 53
- **SSL**: Let's Encrypt certificates auto-renewed
- **Containers**: Docker Compose orchestrates services
- **Proxy**: Nginx handles SSL termination and routing

## Development Tips

1. **API Testing**: Use Swagger UI at `http://localhost:8000/docs`
2. **Frontend Proxy**: Configured to proxy `/api` to backend in development
3. **Environment Variables**: Backend uses `.env` file (not in repo)
4. **Database Migrations**: SQLModel handles schema updates automatically

## Project Structure

```
amanu/
├── backend/           # FastAPI application
│   ├── main.py       # Application entry point
│   ├── models.py     # SQLModel database models
│   └── routers/      # API endpoints
├── frontend/         # Angular application
│   ├── src/app/     
│   │   ├── pages/   # Component pages
│   │   └── services/ # Angular services
│   └── src/assets/i18n/ # Translation files
├── infrastructure/   # AWS CDK infrastructure code
├── deploy.sh        # Deployment script
└── docker-compose.yml # Container orchestration
```