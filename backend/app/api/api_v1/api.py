from fastapi import APIRouter

from app.api.api_v1.endpoints import (
    auth, users, categories, brands, products, orders, admin, promotions,
    cross_sell_promotions, volume_discounts, push, user_notifications,
    user_groups, restock, drivers, shipping, driver_trips, driver_admin,
    admin_batching, customer_routes, roads, purchase_orders, suppliers,
    facturation, admin_tools, segments, returns
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(user_groups.router, prefix="/user-groups", tags=["User Groups"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_router.include_router(promotions.router, prefix="/promotions", tags=["Promotions"])
api_router.include_router(cross_sell_promotions.router, prefix="/cross-sell-promotions", tags=["Cross-Sell Promotions"])
api_router.include_router(volume_discounts.router, prefix="/volume-discounts", tags=["Volume Discounts"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(push.router, prefix="/push", tags=["Push Notifications"])
api_router.include_router(user_notifications.router, prefix="/notifications", tags=["User Notifications"])
api_router.include_router(restock.router, prefix="/restock", tags=["Restock"])
api_router.include_router(drivers.router, prefix="/drivers", tags=["Drivers"])
api_router.include_router(driver_trips.router, prefix="/driver/trips", tags=["Driver Trips"])
api_router.include_router(driver_admin.router, prefix="/admin/drivers", tags=["Driver Admin"])
api_router.include_router(shipping.router, prefix="/shipping", tags=["Shipping"])
api_router.include_router(admin_batching.router, prefix="/admin/batching", tags=["Admin Batching"])
api_router.include_router(customer_routes.router, prefix="/admin/routes", tags=["Customer Routes"])
api_router.include_router(roads.router, prefix="/roads", tags=["Roads"])
api_router.include_router(purchase_orders.router, prefix="/purchase-orders", tags=["Purchase Orders"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(facturation.router, prefix="/facturation", tags=["Facturation"])
api_router.include_router(admin_tools.router, prefix="/admin/tools", tags=["Admin Tools"])
api_router.include_router(segments.router, prefix="/segments", tags=["Segments"])
api_router.include_router(returns.router, prefix="/returns", tags=["Returns"])