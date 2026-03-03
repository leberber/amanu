from fastapi import APIRouter

from app.api.api_v1.endpoints import auth, users, categories, brands, products, orders, admin, promotions, push, user_notifications

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(brands.router, prefix="/brands", tags=["Brands"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_router.include_router(promotions.router, prefix="/promotions", tags=["Promotions"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(push.router, prefix="/push", tags=["Push Notifications"])
api_router.include_router(user_notifications.router, prefix="/notifications", tags=["User Notifications"])