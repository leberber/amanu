from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User, UserRole
from app.models.product import Product
from app.models.category import Category
from app.models.order import Order, OrderStatus, OrderItem
from app.core.security import get_current_admin_user, get_current_staff_user

router = APIRouter()

# Response models
class DashboardStats(BaseModel):
    total_users: int
    total_products: int
    total_categories: int
    total_orders: int
    total_revenue: float
    pending_orders: int
    low_stock_products: int
    top_selling_products: List[Dict[str, Any]]
    recent_orders: List[Dict[str, Any]]
    sales_by_category: List[Dict[str, Any]]

class SalesReport(BaseModel):
    period: str
    data: List[Dict[str, Any]]
    total_sales: float

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get dashboard statistics (staff only).
    """
    # Calculate statistics
    total_users = session.exec(select(func.count()).select_from(User)).first()
    total_products = session.exec(select(func.count()).select_from(Product)).first()
    total_categories = session.exec(select(func.count()).select_from(Category)).first()
    total_orders = session.exec(select(func.count()).select_from(Order)).first()
    
    # Calculate total revenue
    total_revenue = session.exec(
        select(func.sum(Order.total_amount)).where(Order.status != OrderStatus.CANCELLED)
    ).first() or 0.0
    
    # Count pending orders
    pending_orders = session.exec(
        select(func.count()).select_from(Order).where(Order.status == OrderStatus.PENDING)
    ).first()
    
    # Count low stock products (less than 10 items)
    low_stock_products = session.exec(
        select(func.count()).select_from(Product).where(
            Product.stock_quantity < 10,
            Product.is_active == True
        )
    ).first()
    
    # The rest of your function...
    
    # Get top selling products
    top_products_query = select(
        OrderItem.product_id,
        OrderItem.product_name,
        func.sum(OrderItem.quantity).label("total_quantity"),
        func.sum(OrderItem.quantity * OrderItem.unit_price).label("total_sales")
    ).join(Order).where(
        Order.status != OrderStatus.CANCELLED
    ).group_by(
        OrderItem.product_id, 
        OrderItem.product_name  # Added product_name here
    ).order_by(
        func.sum(OrderItem.quantity).desc()
    ).limit(5)

    
    top_selling_products = []
    top_products_result = session.exec(top_products_query).all()
    
    for product_id, product_name, total_quantity, total_sales in top_products_result:
        product = session.get(Product, product_id)
        category_name = "Unknown"
        
        if product and product.category_id:
            category = session.get(Category, product.category_id)
            if category:
                category_name = category.name
        
        top_selling_products.append({
            "product_id": product_id,
            "name": product_name,
            "total_quantity": total_quantity,
            "total_sales": total_sales,
            "category": category_name
        })
    
    # Get recent orders
    recent_orders_query = select(Order).order_by(Order.created_at.desc()).limit(5)
    recent_orders = []
    
    for order in session.exec(recent_orders_query):
        user = session.get(User, order.user_id)
        username = user.full_name if user else "Unknown"
        
        recent_orders.append({
            "order_id": order.id,
            "status": order.status,
            "total_amount": order.total_amount,
            "created_at": order.created_at.isoformat(),
            "customer_name": username
        })
    
    # Get sales by category
    sales_by_category_query = select(
        Product.category_id,
        func.sum(OrderItem.quantity * OrderItem.unit_price).label("total_sales")
    ).join(OrderItem, Product.id == OrderItem.product_id).join(
        Order, OrderItem.order_id == Order.id
    ).where(
        Order.status != OrderStatus.CANCELLED
    ).group_by(
        Product.category_id
    )
    
    sales_by_category = []
    sales_by_category_result = session.exec(sales_by_category_query).all()
    
    for category_id, total_sales in sales_by_category_result:
        category = session.get(Category, category_id)
        category_name = category.name if category else "Unknown"
        
        sales_by_category.append({
            "category_id": category_id,
            "name": category_name,
            "total_sales": total_sales
        })
    
    return DashboardStats(
        total_users=total_users,
        total_products=total_products,
        total_categories=total_categories,
        total_orders=total_orders,
        total_revenue=total_revenue,
        pending_orders=pending_orders,
        low_stock_products=low_stock_products,
        top_selling_products=top_selling_products,
        recent_orders=recent_orders,
        sales_by_category=sales_by_category
    )

@router.get("/sales-report", response_model=SalesReport)
def get_sales_report(
    period: str = Query(..., enum=["daily", "weekly", "monthly", "yearly"]),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get sales report for a specific period (staff only).
    """
    # Set default date range if not provided
    if not end_date:
        end_date = datetime.now(timezone.utc)
    
    if not start_date:
        if period == "daily":
            # Last 30 days
            start_date = end_date - timedelta(days=30)
        elif period == "weekly":
            # Last 12 weeks
            start_date = end_date - timedelta(weeks=12)
        elif period == "monthly":
            # Last 12 months
            start_date = end_date - timedelta(days=365)
        elif period == "yearly":
            # Last 5 years
            start_date = end_date - timedelta(days=365 * 5)
    
    # Query orders within date range
    orders_query = select(Order).where(
        Order.created_at >= start_date,
        Order.created_at <= end_date,
        Order.status != OrderStatus.CANCELLED
    )
    
    orders = session.exec(orders_query).all()
    
    # Organize data by period
    data = []
    total_sales = 0
    
    if period == "daily":
        # Group by day
        sales_by_day = {}
        for order in orders:
            day = order.created_at.date()
            sales_by_day[day] = sales_by_day.get(day, 0) + order.total_amount
            total_sales += order.total_amount
        
        # Format data
        for day, amount in sorted(sales_by_day.items()):
            data.append({
                "date": day.isoformat(),
                "sales": amount
            })
    
    elif period == "weekly":
        # Group by week
        sales_by_week = {}
        for order in orders:
            # Calculate week number and year
            year = order.created_at.year
            week = order.created_at.isocalendar()[1]
            week_key = f"{year}-W{week:02d}"
            
            sales_by_week[week_key] = sales_by_week.get(week_key, 0) + order.total_amount
            total_sales += order.total_amount
        
        # Format data
        for week_key, amount in sorted(sales_by_week.items()):
            data.append({
                "date": week_key,
                "sales": amount
            })
    
    elif period == "monthly":
        # Group by month
        sales_by_month = {}
        for order in orders:
            month_key = f"{order.created_at.year}-{order.created_at.month:02d}"
            
            sales_by_month[month_key] = sales_by_month.get(month_key, 0) + order.total_amount
            total_sales += order.total_amount
        
        # Format data
        for month_key, amount in sorted(sales_by_month.items()):
            data.append({
                "date": month_key,
                "sales": amount
            })
    
    elif period == "yearly":
        # Group by year
        sales_by_year = {}
        for order in orders:
            year = order.created_at.year
            
            sales_by_year[year] = sales_by_year.get(year, 0) + order.total_amount
            total_sales += order.total_amount
        
        # Format data
        for year, amount in sorted(sales_by_year.items()):
            data.append({
                "date": str(year),
                "sales": amount
            })
    
    return SalesReport(
        period=period,
        data=data,
        total_sales=total_sales
    )

@router.get("/low-stock", response_model=List[Dict[str, Any]])
def get_low_stock_products(
    threshold: int = Query(default=10, ge=1),
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get products with low stock (staff only).
    """
    # Query low stock products
    query = select(Product).where(
        Product.stock_quantity <= threshold,
        Product.is_active == True
    ).order_by(Product.stock_quantity)
    
    products = session.exec(query).all()
    
    # Format response
    result = []
    for product in products:
        category = session.get(Category, product.category_id)
        category_name = category.name if category else "Unknown"
        
        result.append({
            "id": product.id,
            "name": product.name,
            "category": category_name,
            "stock_quantity": product.stock_quantity,
            "price": product.price,
            "unit": product.unit
        })
    
    return result