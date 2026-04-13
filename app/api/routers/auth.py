from fastapi import APIRouter, Depends, HTTPException
from app.api.schemas import UserAuth, Token
from app.storage.postgres import get_user_by_username, create_user
from app.storage.auth import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
async def register(user_in: UserAuth):
    existing = get_user_by_username(user_in.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed = get_password_hash(user_in.password)
    user_id = create_user(user_in.username, hashed)
    return {"status": "ok", "user_id": user_id}


@router.post("/login", response_model=Token)
async def login(user_in: UserAuth):
    user = get_user_by_username(user_in.username)
    if not user or not verify_password(user_in.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user["username"], "user_id": str(user["id"])})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user
