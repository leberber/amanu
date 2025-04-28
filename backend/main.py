from typing import Union, Optional, List
from datetime import datetime
from fastapi import FastAPI # type: ignore
from pydantic import BaseModel # type: ignore
from sql_api import PostgesAPI

DATABASE_URL = "postgresql://postgres:it is me@localhost:5432/vtx"
sql_api = PostgesAPI(DATABASE_URL)
app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware # type: ignore

# CORS Middleware to allow all
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    email: str
    password: str

class User(BaseModel):
    user_id: Optional[int] = None
    nom: str
    prenom: str
    email: str
    mobile: str
    address: str
    commune: str
    village: str
    wilaya: str
    profile_picture: Optional[str] = None
    password: Optional[str] = None
    role: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

@app.post("/v1/Login")
async def login(loginRequest: LoginRequest):
    """Simple login route that validates user credentials"""
    loginRequest = loginRequest.dict()
    print(loginRequest)

    user = sql_api.select(f"SELECT * FROM users WHERE email = '{loginRequest['email']}'")
    if user and len(user) > 0:
        user = user[0]
        if user['password'] == loginRequest['password']:
            return {"message": "Login successful", "user": user}
        else:
            return {"message": "Incorrect Password"}
    else:
        return {"message": "No account with that email"}

@app.get("/v1/users")
async def get_all_users():
    """Get all users excluding password field"""
    users = sql_api.select("""
        SELECT 
            user_id, nom, prenom, email, mobile, address, commune, 
            village, wilaya, profile_picture AS "profilePicture", role, 
            created_at AS "createdAt", updated_at AS "updatedAt" 
        FROM users
    """)
    return users

@app.get("/v1/users/{user_id}")
async def get_user_by_id(user_id: int):
    """Get a single user by ID"""
    conditions = {"user_id": user_id}
    user = sql_api.safe_select("users", conditions)
    if user and len(user) > 0:
        return user[0]
    return {"message": "User not found"}

@app.post("/v1/users/add")
async def create_user(user: User):
    """Create a new user"""
    user_dict = user.dict(exclude={"user_id", "createdAt", "updatedAt"})
    print(user_dict)

    now = datetime.now()
    user_dict["created_at"] = now
    user_dict["updated_at"] = now
    
    # Insert the user
    try:
        sql_api.safe_insert("users", user_dict)
        # new_user = sql_api.select(f"SELECT * FROM users WHERE email = '{user.email}' ORDER BY user_id DESC LIMIT 1")
        print('suss')
        return {"message": "User Added Successfully"}
    except Exception as e:
        print("Error:", e)
        return {"message": "Failed to create user"}
    
        




@app.put("/v1/users/update/{email}")
async def update_user(email: str, user: User):
    """Update an existing user"""
    # Prepare update parameters
    update_data = user.dict(exclude={"user_id", "createdAt", "updatedAt"})
    print(update_data)
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    update_data["updated_at"] = datetime.now()
    
    # Prepare parameters for safe_update
    params = {
        "SET": update_data,
        "WHERE": "email",
        "CONDITION": email
    }
    print(params)
    try:
        sql_api.safe_update("users", params)
        # new_user = sql_api.select(f"SELECT * FROM users WHERE email = '{user.email}' ORDER BY user_id DESC LIMIT 1")
        return {"message": "User Updated Successfully"}
    except Exception as e:
        print("Error:", e)
        return {"message": "Failed to update user"}
    
    # Return the updated user


@app.delete("/v1/users/{user_id}")
async def delete_user(user_id: int):
    """Delete a user"""
    # Check if user exists
    user = sql_api.safe_select("users", {"user_id": user_id})
    if not user or len(user) == 0:
        return {"message": "User not found"}
    
    # Delete the user
    result = sql_api.safe_delete("users", {"user_id": user_id})
    return {"message": "User deleted successfully"}

