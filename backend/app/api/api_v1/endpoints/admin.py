from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from sqlalchemy import Integer, case, extract, cast, Date
from pydantic import BaseModel

from app.database import get_session
from app.models.user import User, UserRole
from app.models.product import Product
from app.models.category import Category
from app.models.brand import Brand
from app.models.order import Order, OrderStatus, OrderItem, DeliveryType
from app.models.order_payments import OrderAuditLog, AuditAction
from app.api.utils.common import format_price
from app.api.api_v1.endpoints.orders import _recalculate_order_margin
from app.core.security import get_current_admin_user, get_current_staff_user
from app.core.logging_config import read_logs, get_log_stats
from app.core.system_metrics import get_metrics

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
    sales_by_brand: List[Dict[str, Any]]

class SalesReport(BaseModel):
    period: str
    data: List[Dict[str, Any]]
    total_sales: float
    sales_by_category: List[Dict[str, Any]] = []
    sales_by_brand: List[Dict[str, Any]] = []
    top_products: List[Dict[str, Any]] = []

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get dashboard statistics (staff only).
    """
    # Combined query for order stats (total, pending, revenue) - 1 query instead of 3
    order_stats = session.exec(
        select(
            func.count(Order.id),
            func.sum(func.cast(Order.status == OrderStatus.PENDING, Integer)),
            func.sum(
                case(
                    (Order.status != OrderStatus.CANCELLED, Order.total_amount),
                    else_=0
                )
            )
        ).select_from(Order)
    ).first()
    total_orders = order_stats[0] or 0
    pending_orders = order_stats[1] or 0
    total_revenue = order_stats[2] or 0.0

    # Combined query for product stats (total, low stock) - 1 query instead of 2
    product_stats = session.exec(
        select(
            func.count(Product.id),
            func.sum(
                func.cast(
                    (Product.stock_quantity < 10) & (Product.is_active == True),
                    Integer
                )
            )
        ).select_from(Product)
    ).first()
    total_products = product_stats[0] or 0
    low_stock_products = product_stats[1] or 0

    # These remain separate as they're different tables
    total_users = session.exec(select(func.count()).select_from(User)).first()
    total_categories = session.exec(select(func.count()).select_from(Category)).first()
    
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

    
    top_products_result = session.exec(top_products_query).all()

    # Batch load products and categories to avoid N+1
    product_ids = [row[0] for row in top_products_result]
    products_map = {}
    category_ids = set()

    if product_ids:
        products = session.exec(select(Product).where(Product.id.in_(product_ids))).all()
        products_map = {p.id: p for p in products}
        category_ids = {p.category_id for p in products if p.category_id}

    categories_map = {}
    if category_ids:
        categories = session.exec(select(Category).where(Category.id.in_(category_ids))).all()
        categories_map = {c.id: c for c in categories}

    top_selling_products = []
    for product_id, product_name, total_quantity, total_sales in top_products_result:
        product = products_map.get(product_id)
        category_name = "Unknown"

        if product and product.category_id:
            category = categories_map.get(product.category_id)
            if category:
                category_name = category.name

        top_selling_products.append({
            "product_id": product_id,
            "name": product_name,
            "total_quantity": total_quantity,
            "total_sales": total_sales,
            "category": category_name,
            "image_url": product.image_url if product else None
        })

    # Get recent orders with users in a single JOIN query
    recent_orders_query = (
        select(Order, User)
        .outerjoin(User, Order.user_id == User.id)
        .order_by(Order.created_at.desc())
        .limit(5)
    )
    recent_orders = []

    for order, user in session.exec(recent_orders_query):
        recent_orders.append({
            "order_id": order.id,
            "status": order.status,
            "total_amount": order.total_amount,
            "created_at": order.created_at.isoformat(),
            "customer_name": user.full_name if user else "Unknown"
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
    
    sales_by_category_result = session.exec(sales_by_category_query).all()

    # Batch load categories to avoid N+1
    cat_ids_for_sales = [row[0] for row in sales_by_category_result if row[0]]
    sales_categories_map = {}
    if cat_ids_for_sales:
        cats = session.exec(select(Category).where(Category.id.in_(cat_ids_for_sales))).all()
        sales_categories_map = {c.id: c for c in cats}

    sales_by_category = []
    for category_id, total_sales in sales_by_category_result:
        category = sales_categories_map.get(category_id)
        sales_by_category.append({
            "category_id": category_id,
            "name": category.name if category else "Unknown",
            "total_sales": total_sales
        })

    # Get sales by brand
    sales_by_brand_query = select(
        Product.brand_id,
        func.sum(OrderItem.quantity * OrderItem.unit_price).label("total_sales")
    ).join(OrderItem, Product.id == OrderItem.product_id).join(
        Order, OrderItem.order_id == Order.id
    ).where(
        Order.status != OrderStatus.CANCELLED,
        Product.brand_id.isnot(None)
    ).group_by(
        Product.brand_id
    )

    sales_by_brand_result = session.exec(sales_by_brand_query).all()

    # Batch load brands to avoid N+1
    brand_ids_for_sales = [row[0] for row in sales_by_brand_result if row[0]]
    sales_brands_map = {}
    if brand_ids_for_sales:
        brands = session.exec(select(Brand).where(Brand.id.in_(brand_ids_for_sales))).all()
        sales_brands_map = {b.id: b for b in brands}

    sales_by_brand = []
    for brand_id, total_sales in sales_by_brand_result:
        brand = sales_brands_map.get(brand_id)
        sales_by_brand.append({
            "brand_id": brand_id,
            "name": brand.name if brand else "Unknown",
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
        sales_by_category=sales_by_category,
        sales_by_brand=sales_by_brand
    )

@router.get("/sales-report", response_model=SalesReport)
def get_sales_report(
    period: str = Query(..., enum=["daily", "weekly", "monthly", "yearly"]),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category_limit: Optional[int] = Query(default=10, ge=1, le=100),
    product_limit: Optional[int] = Query(default=10, ge=1, le=50),
    category_id: Optional[int] = Query(default=None),
    brand_id: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """
    Get sales report for a specific period (staff only).
    Uses database GROUP BY for efficiency instead of loading all orders into Python.
    Supports filtering by category_id and/or brand_id.
    """
    # Set default date range if not provided
    if not end_date:
        end_date = datetime.now(timezone.utc)

    if not start_date:
        if period == "daily":
            start_date = end_date - timedelta(days=30)
        elif period == "weekly":
            start_date = end_date - timedelta(weeks=12)
        elif period == "monthly":
            start_date = end_date - timedelta(days=365)
        elif period == "yearly":
            start_date = end_date - timedelta(days=365 * 5)

    # Base filter for all queries
    base_filter = [
        Order.created_at >= start_date,
        Order.created_at <= end_date,
        Order.status != OrderStatus.CANCELLED
    ]

    # Product filters for cross-filtering
    product_filters = []
    if category_id:
        product_filters.append(Product.category_id == category_id)
    if brand_id:
        product_filters.append(Product.brand_id == brand_id)
    has_filter = bool(product_filters)

    data = []

    if period == "daily":
        if has_filter:
            query = (
                select(
                    cast(Order.created_at, Date).label("day"),
                    func.sum(OrderItem.unit_price * OrderItem.quantity).label("sales")
                )
                .select_from(Order)
                .join(OrderItem, OrderItem.order_id == Order.id)
                .join(Product, Product.id == OrderItem.product_id)
                .where(*base_filter, *product_filters)
                .group_by(cast(Order.created_at, Date))
                .order_by(cast(Order.created_at, Date))
            )
        else:
            query = select(
                cast(Order.created_at, Date).label("day"),
                func.sum(Order.total_amount).label("sales")
            ).where(*base_filter).group_by(
                cast(Order.created_at, Date)
            ).order_by(cast(Order.created_at, Date))

        results = session.exec(query).all()
        for day, sales in results:
            data.append({
                "date": day.isoformat() if day else "",
                "sales": float(sales) if sales else 0
            })

    elif period == "weekly":
        year_col = extract("year", Order.created_at)
        week_col = extract("week", Order.created_at)

        if has_filter:
            query = (
                select(
                    year_col.label("year"),
                    week_col.label("week"),
                    func.sum(OrderItem.unit_price * OrderItem.quantity).label("sales")
                )
                .select_from(Order)
                .join(OrderItem, OrderItem.order_id == Order.id)
                .join(Product, Product.id == OrderItem.product_id)
                .where(*base_filter, *product_filters)
                .group_by(year_col, week_col)
                .order_by(year_col, week_col)
            )
        else:
            query = select(
                year_col.label("year"),
                week_col.label("week"),
                func.sum(Order.total_amount).label("sales")
            ).where(*base_filter).group_by(
                year_col, week_col
            ).order_by(year_col, week_col)

        results = session.exec(query).all()
        for year, week, sales in results:
            week_key = f"{int(year)}-W{int(week):02d}"
            data.append({
                "date": week_key,
                "sales": float(sales) if sales else 0
            })

    elif period == "monthly":
        year_col = extract("year", Order.created_at)
        month_col = extract("month", Order.created_at)

        if has_filter:
            query = (
                select(
                    year_col.label("year"),
                    month_col.label("month"),
                    func.sum(OrderItem.unit_price * OrderItem.quantity).label("sales")
                )
                .select_from(Order)
                .join(OrderItem, OrderItem.order_id == Order.id)
                .join(Product, Product.id == OrderItem.product_id)
                .where(*base_filter, *product_filters)
                .group_by(year_col, month_col)
                .order_by(year_col, month_col)
            )
        else:
            query = select(
                year_col.label("year"),
                month_col.label("month"),
                func.sum(Order.total_amount).label("sales")
            ).where(*base_filter).group_by(
                year_col, month_col
            ).order_by(year_col, month_col)

        results = session.exec(query).all()
        for year, month, sales in results:
            month_key = f"{int(year)}-{int(month):02d}"
            data.append({
                "date": month_key,
                "sales": float(sales) if sales else 0
            })

    elif period == "yearly":
        year_col = extract("year", Order.created_at)

        if has_filter:
            query = (
                select(
                    year_col.label("year"),
                    func.sum(OrderItem.unit_price * OrderItem.quantity).label("sales")
                )
                .select_from(Order)
                .join(OrderItem, OrderItem.order_id == Order.id)
                .join(Product, Product.id == OrderItem.product_id)
                .where(*base_filter, *product_filters)
                .group_by(year_col)
                .order_by(year_col)
            )
        else:
            query = select(
                year_col.label("year"),
                func.sum(Order.total_amount).label("sales")
            ).where(*base_filter).group_by(
                year_col
            ).order_by(year_col)

        results = session.exec(query).all()
        for year, sales in results:
            data.append({
                "date": str(int(year)),
                "sales": float(sales) if sales else 0
            })

    # Calculate total from aggregated data (already computed by DB)
    total_sales = sum(item["sales"] for item in data)

    # Calculate sales by category for this period (apply brand filter only)
    category_filters = []
    if brand_id:
        category_filters.append(Product.brand_id == brand_id)

    category_sales_query = (
        select(
            Category.id.label("category_id"),
            func.sum(OrderItem.unit_price * OrderItem.quantity).label("total_sales")
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .join(Category, Category.id == Product.category_id)
        .where(*base_filter, *category_filters)
        .group_by(Category.id)
        .order_by(func.sum(OrderItem.unit_price * OrderItem.quantity).desc())
        .limit(category_limit)
    )

    category_results = session.exec(category_sales_query).all()

    # Fetch full category details for translations
    category_ids = [row.category_id for row in category_results]
    categories_map = {}
    if category_ids:
        categories = session.exec(select(Category).where(Category.id.in_(category_ids))).all()
        categories_map = {c.id: c for c in categories}

    sales_by_category = []
    for row in category_results:
        cat = categories_map.get(row.category_id)
        sales_by_category.append({
            "category_id": row.category_id,
            "name": cat.name if cat else "",
            "name_translations": cat.name_translations if cat else None,
            "total_sales": float(row.total_sales) if row.total_sales else 0
        })

    # Calculate sales by brand for this period (apply category filter only)
    brand_filters = []
    if category_id:
        brand_filters.append(Product.category_id == category_id)

    brand_query = (
        select(
            Product.brand_id,
            func.sum(OrderItem.unit_price * OrderItem.quantity).label("total_sales")
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(*base_filter, *brand_filters)
        .where(Product.brand_id.isnot(None))
        .group_by(Product.brand_id)
        .order_by(func.sum(OrderItem.unit_price * OrderItem.quantity).desc())
        .limit(category_limit)
    )

    brand_results = session.exec(brand_query).all()

    # Fetch brand details
    brand_ids = [row[0] for row in brand_results if row[0]]
    brands_map = {}
    if brand_ids:
        brands = session.exec(select(Brand).where(Brand.id.in_(brand_ids))).all()
        brands_map = {b.id: b for b in brands}

    sales_by_brand = []
    for b_id, b_sales in brand_results:
        brand = brands_map.get(b_id)
        sales_by_brand.append({
            "brand_id": b_id,
            "name": brand.name if brand else "",
            "name_translations": brand.name_translations if brand else None,
            "total_sales": float(b_sales) if b_sales else 0
        })

    # Calculate top selling products for this period (apply both filters)
    top_products_query = (
        select(
            Product.id.label("product_id"),
            func.sum(OrderItem.quantity).label("total_quantity"),
            func.sum(OrderItem.unit_price * OrderItem.quantity).label("total_sales")
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(*base_filter, *product_filters)
        .group_by(Product.id)
        .order_by(func.sum(OrderItem.unit_price * OrderItem.quantity).desc())
        .limit(product_limit)
    )

    product_results = session.exec(top_products_query).all()

    # Fetch full product details
    product_ids = [row.product_id for row in product_results]
    products_map = {}
    if product_ids:
        products = session.exec(select(Product).where(Product.id.in_(product_ids))).all()
        products_map = {p.id: p for p in products}

    top_products = []
    for row in product_results:
        prod = products_map.get(row.product_id)
        top_products.append({
            "product_id": row.product_id,
            "name": prod.name if prod else "",
            "name_translations": prod.name_translations if prod else None,
            "image_url": prod.image_url if prod else None,
            "total_quantity": int(row.total_quantity) if row.total_quantity else 0,
            "total_sales": float(row.total_sales) if row.total_sales else 0
        })

    return SalesReport(
        period=period,
        data=data,
        total_sales=total_sales,
        sales_by_category=sales_by_category,
        sales_by_brand=sales_by_brand,
        top_products=top_products
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

    # Batch load categories to avoid N+1
    category_ids = {p.category_id for p in products if p.category_id}
    categories_map = {}
    if category_ids:
        categories = session.exec(select(Category).where(Category.id.in_(category_ids))).all()
        categories_map = {c.id: c for c in categories}

    # Format response
    result = []
    for product in products:
        category = categories_map.get(product.category_id)
        result.append({
            "id": product.id,
            "name": product.name,
            "category": category.name if category else "Unknown",
            "stock_quantity": product.stock_quantity,
            "price": product.price,
            "unit": product.unit
        })

    return result


# =============================================================================
# LOGS ENDPOINTS
# =============================================================================

class LogEntry(BaseModel):
    timestamp: str
    level: str
    logger: str
    message: str


class LogsResponse(BaseModel):
    entries: List[LogEntry]
    stats: Dict[str, Any]


@router.get("/logs", response_model=LogsResponse)
def get_application_logs(
    lines: int = Query(default=100, ge=10, le=1000, description="Number of log lines to return"),
    level: Optional[str] = Query(default=None, description="Filter by log level (INFO, WARNING, ERROR)"),
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Get recent application logs (admin only).

    - **lines**: Number of recent log entries to return (10-1000)
    - **level**: Optional filter by log level
    """
    entries = read_logs(lines=lines, level=level)
    stats = get_log_stats()

    return LogsResponse(
        entries=[LogEntry(**e) for e in entries],
        stats=stats
    )


# =============================================================================
# SYSTEM METRICS ENDPOINTS
# =============================================================================

@router.get("/system")
def get_system_metrics(
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Get system performance metrics (admin only).

    Returns CPU, memory, disk usage, and API performance stats.
    """
    metrics = get_metrics()
    return metrics.get_all_metrics()


@router.get("/system/health")
def get_system_health(
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Get quick system health status (admin only).

    Returns a simple health check with status indicators.
    """
    metrics = get_metrics()
    system = metrics.get_system_stats()
    api = metrics.get_api_stats()
    uptime = metrics.get_uptime()

    # Determine overall health
    issues = []
    if system["cpu"]["status"] == "high":
        issues.append("High CPU usage")
    if system["memory"]["status"] == "high":
        issues.append("High memory usage")
    if system["disk"]["status"] == "high":
        issues.append("Low disk space")
    if api["status"] == "high":
        issues.append("High error rate")

    if len(issues) >= 2:
        overall = "critical"
    elif len(issues) == 1:
        overall = "warning"
    else:
        overall = "healthy"

    return {
        "status": overall,
        "issues": issues,
        "uptime": uptime["uptime_human"],
        "cpu_percent": system["cpu"]["percent"],
        "memory_percent": system["memory"]["percent"],
        "disk_percent": system["disk"]["percent"],
        "error_rate": api["error_rate"],
        "requests_per_minute": api["requests_per_minute"]
    }


@router.get("/system/errors")
def get_system_errors(
    current_user: User = Depends(get_current_staff_user),
    limit: int = Query(50, le=100, description="Number of errors to return")
) -> Any:
    """
    Get recent API errors with details (admin only).

    Returns the last N errors with timestamp, endpoint, status code, and error message.
    """
    metrics = get_metrics()
    return {
        "errors": metrics.get_recent_errors(limit),
        "total_errors": metrics.request_metrics.total_errors
    }


@router.delete("/system/errors")
def clear_system_errors(
    current_user: User = Depends(get_current_staff_user),
) -> Any:
    """
    Clear the error log (admin only).
    """
    metrics = get_metrics()
    metrics.clear_errors()
    return {"message": "Error log cleared"}


# ─── Admin: Create order on behalf of a customer ──────────────────────────────

class AdminOrderCreateItem(BaseModel):
    product_id: int
    quantity: float
    custom_unit_price: Optional[float] = None

class AdminOrderCreatePayload(BaseModel):
    user_id: int
    items: List[AdminOrderCreateItem]
    delivery_type: str = "pickup"  # "pickup" or "delivery"
    shipping_cost: float = 0.0

@router.post("/create-order")
def admin_create_order(
    data: AdminOrderCreatePayload,
    current_user: User = Depends(get_current_staff_user),
    session: Session = Depends(get_session),
) -> Any:
    """Create an order on behalf of a customer (staff/admin only)."""

    target_user = session.get(User, data.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not data.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    product_ids = [item.product_id for item in data.items]
    products = session.exec(select(Product).where(Product.id.in_(product_ids))).all()
    products_map = {p.id: p for p in products}

    order_items = []
    subtotal = 0.0
    total_weight_kg = 0.0

    for item in data.items:
        product = products_map.get(item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if not product.is_active:
            raise HTTPException(status_code=400, detail=f"Product '{product.name}' is not available")
        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for '{product.name}'. Available: {product.stock_quantity}"
            )

        effective_price = item.custom_unit_price if item.custom_unit_price is not None else product.price
        subtotal += effective_price * item.quantity
        if product.weight:
            total_weight_kg += product.weight * item.quantity

        order_items.append(OrderItem(
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=product.price,
            custom_unit_price=item.custom_unit_price,
            product_name=product.name,
            product_unit=product.unit,
            pieces_per_box=product.pieces_per_box,
            packaging_type=product.packaging_type,
            order_id=0,
        ))

        product.stock_quantity -= item.quantity
        session.add(product)

    subtotal = format_price(subtotal)

    order = Order(
        user_id=target_user.id,
        status=OrderStatus.READY if data.delivery_type == "pickup" else OrderStatus.CONFIRMED,
        shipping_address=target_user.address or "",
        contact_phone=target_user.phone or "",
        subtotal=subtotal,
        discount_amount=0,
        cross_sell_discount_amount=0,
        volume_discount_amount=0,
        shipping_cost=format_price(data.shipping_cost),
        total_amount=format_price(subtotal + data.shipping_cost),
        total_weight_kg=total_weight_kg,
        delivery_type=DeliveryType.PICKUP if data.delivery_type == "pickup" else DeliveryType.STANDARD,
    )

    session.add(order)
    session.commit()
    session.refresh(order)

    for item in order_items:
        item.order_id = order.id
        session.add(item)

    audit = OrderAuditLog(
        order_id=order.id,
        user_id=current_user.id,
        action=AuditAction.ORDER_CREATED,
        details={"created_by_admin": True, "admin_name": current_user.full_name or current_user.email},
    )
    session.add(audit)
    session.flush()

    _recalculate_order_margin(order, session)

    session.commit()

    return {"order_id": order.id}