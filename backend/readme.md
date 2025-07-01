# Fresh Produce E-commerce API

A modern FastAPI backend for an e-commerce platform that sells fruits and vegetables.

## Features

- 🔐 **Authentication & Authorization**: JWT token-based authentication with role-based access control (Customer, Staff, Admin)
- 📦 **Product Management**: Categories for organizing produce with support for organic labeling
- 🛒 **Shopping Cart**: Full shopping cart functionality with stock management
- 📋 **Order Processing**: Complete order lifecycle management
- 📊 **Admin Dashboard**: Sales analytics, low stock alerts, and comprehensive reporting
- 🌱 **Sample Data**: Pre-populated with categories and products

## Tech Stack

- **FastAPI**: High-performance API framework
- **SQLModel**: ORM for database interactions
- **Pydantic**: Data validation and settings management
- **JWT**: Authentication with security best practices
- **Docker**: Containerization for easy deployment

## Project Structure

```
├── app
│   ├── api
│   │   ├── api_v1
│   │   │   ├── endpoints
│   │   │   │   ├── admin.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── cart.py
│   │   │   │   ├── categories.py
│   │   │   │   ├── orders.py
│   │   │   │   ├── products.py
│   │   │   │   └── users.py
│   │   │   └── api.py
│   │   └── utils
│   │       └── common.py
│   ├── core
│   │   ├── admin.py
│   │   ├── config.py
│   │   └── security.py
│   ├── models
│   │   ├── cart.py
│   │   ├── category.py
│   │   ├── order.py
│   │   ├── product.py
│   │   └── user.py
│   ├── database.py
│   └── seed_data.py
├── main.py
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## Setup and Installation

### Using Docker (Recommended)

1. Clone the repository
2. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```
3. API will be available at http://localhost:8000
4. API documentation at http://localhost:8000/docs

### Manual Setup

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file with the following variables:
   ```
   DATABASE_URL=sqlite:///./app.db
   SECRET_KEY=your-super-secret-key-change-this-in-production
   ADMIN_EMAIL=admin@freshproduce.com
   ADMIN_PASSWORD=admin123
   ADMIN_NAME=Admin User
   BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
   ```
5. Run the application:
   ```bash
   uvicorn main:app --reload
   ```
6. API will be available at http://localhost:8000
7. API documentation at http://localhost:8000/docs

## API Documentation

Once the application is running, you can access the interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Default Admin User

The application creates a default admin user on startup:
- **Email**: admin@freshproduce.com
- **Password**: admin123

## Main Endpoints

### Authentication
- `POST /api/v1/auth/login` - Get access token
- `POST /api/v1/auth/register` - Register new user

### Users
- `GET /api/v1/users/me` - Get current user
- `PATCH /api/v1/users/me` - Update current user
- `GET /api/v1/users` - List all users (admin only)

### Categories
- `GET /api/v1/categories` - List all categories
- `POST /api/v1/categories` - Create new category (staff only)
- `GET /api/v1/categories/{id}` - Get category details

### Products
- `GET /api/v1/products` - List all products with filtering options
- `POST /api/v1/products` - Create new product (staff only)
- `GET /api/v1/products/{id}` - Get product details

### Cart
- `GET /api/v1/cart/items` - Get cart items
- `POST /api/v1/cart/items` - Add item to cart
- `PATCH /api/v1/cart/items/{id}` - Update cart item quantity
- `DELETE /api/v1/cart/items/{id}` - Remove item from cart

### Orders
- `POST /api/v1/orders` - Create new order
- `GET /api/v1/orders` - List user orders
- `GET /api/v1/orders/{id}` - Get order details
- `PATCH /api/v1/orders/{id}` - Update order status (staff only)

### Admin
- `GET /api/v1/admin/dashboard` - Get dashboard statistics
- `GET /api/v1/admin/sales-report` - Get sales reports
- `GET /api/v1/admin/low-stock` - Get low stock products

## License

MIT