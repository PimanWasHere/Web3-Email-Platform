from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import time
import json
import hashlib
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(
    title="Web3 Email Platform API",
    description="Hedera-integrated email platform with consensus timestamping",
    version="1.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security scheme
security = HTTPBearer()

# JWT Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-super-secret-jwt-key-here-use-256-bits')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Pydantic Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class AuthChallengeRequest(BaseModel):
    wallet_address: str
    wallet_type: str = "metamask"

class AuthChallengeResponse(BaseModel):
    message: str
    nonce: str
    timestamp: str

class AuthSignRequest(BaseModel):
    wallet_address: str
    signature: str
    challenge_data: Dict[str, str]
    wallet_type: str = "metamask"

class EmailData(BaseModel):
    from_address: str
    to_addresses: List[str]
    subject: str
    body: str
    attachments: Optional[List[str]] = []

class EmailTimestampRequest(BaseModel):
    email_data: EmailData
    metadata: Optional[Dict[str, Any]] = None

class RicardianContractRequest(BaseModel):
    agreement_data: Dict[str, Any]
    parties: List[str]

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    wallet_address: str
    wallet_type: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EmailRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    email_data: Dict[str, Any]
    content_hash: str
    hedera_transaction_id: Optional[str] = None
    hedera_topic_id: Optional[str] = None
    sequence_number: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None

# Wallet Authentication Service
class WalletAuthService:
    def create_authentication_challenge(self, wallet_address: str) -> Dict[str, str]:
        """Create authentication challenge for wallet signing"""
        timestamp = int(time.time())
        nonce = hashlib.sha256(f"{wallet_address}{timestamp}".encode()).hexdigest()[:16]
        
        challenge_message = (
            f"Sign this message to authenticate with Web3 Email Platform\n"
            f"Address: {wallet_address}\n"
            f"Timestamp: {timestamp}\n"
            f"Nonce: {nonce}"
        )
        
        return {
            "message": challenge_message,
            "nonce": nonce,
            "timestamp": str(timestamp)
        }
    
    def _verify_ethereum_signature(self, message: str, signature: str, address: str) -> bool:
        """Verify Ethereum/MetaMask signature (simplified for demo)"""
        try:
            # In a real implementation, you would use eth_account to verify
            # For now, we'll simulate verification based on wallet address
            return len(signature) > 50 and address.startswith('0x')
        except Exception as e:
            print(f"Ethereum signature verification failed: {e}")
            return False
    
    def _verify_hedera_signature(self, message: str, signature: str, wallet_address: str) -> bool:
        """Verify Hedera/HashPack signature (simplified for demo)"""
        try:
            # In a real implementation, you would use Hedera SDK to verify
            # For now, we'll simulate verification based on signature length and valid Hedera address format
            return len(signature) > 50 and wallet_address.startswith('0.0.')
        except Exception as e:
            print(f"Hedera signature verification failed: {e}")
            return False
    
    def _verify_signature(self, message: str, signature: str, public_key: str, wallet_type: str = "metamask") -> bool:
        """Verify wallet signature for authentication"""
        try:
            if wallet_type.lower() == "metamask":
                return self._verify_ethereum_signature(message, signature, public_key)
            elif wallet_type.lower() == "hashpack":
                return self._verify_hedera_signature(message, signature, public_key)
            else:
                return False
        except Exception as e:
            print(f"Signature verification failed: {e}")
            return False
    
    async def authenticate_wallet(self, wallet_address: str, signature: str,
                                challenge_data: Dict[str, str], 
                                wallet_type: str = "metamask") -> Dict[str, Any]:
        """Authenticate user wallet and create session"""
        try:
            # Verify signature against challenge
            challenge_message = challenge_data["message"]
            
            if not self._verify_signature(
                challenge_message, signature, wallet_address, wallet_type
            ):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid signature"
                )
            
            # Check challenge timestamp (valid for 10 minutes)
            challenge_time = int(challenge_data["timestamp"])
            if time.time() - challenge_time > 600:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Challenge expired"
                )
            
            # Create or get user
            user_doc = await db.users.find_one({"wallet_address": wallet_address})
            if not user_doc:
                user = User(wallet_address=wallet_address, wallet_type=wallet_type)
                await db.users.insert_one(user.dict())
                user_id = user.id
            else:
                user_id = user_doc["id"]
            
            # Create JWT token
            token_data = {
                "user_id": user_id,
                "wallet_address": wallet_address,
                "wallet_type": wallet_type,
                "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
                "iat": datetime.utcnow()
            }
            
            access_token = jwt.encode(
                token_data, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM
            )
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "wallet_address": wallet_address,
                "wallet_type": wallet_type,
                "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Authentication failed: {str(e)}"
            )
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT token and extract user data"""
        try:
            payload = jwt.decode(
                token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

# Email Timestamping Service
class EmailTimestampService:
    def _generate_email_hash(self, email_content: Dict[str, Any]) -> str:
        """Generate deterministic hash of email content"""
        normalized_content = {
            "from": email_content.get("from_address", "").lower().strip(),
            "to": sorted([addr.lower().strip() for addr in email_content.get("to_addresses", [])]),
            "subject": email_content.get("subject", "").strip(),
            "body": email_content.get("body", "").strip(),
            "attachments": sorted(email_content.get("attachments", []))
        }
        
        content_str = json.dumps(normalized_content, sort_keys=True)
        return hashlib.sha256(content_str.encode('utf-8')).hexdigest()
    
    async def timestamp_email(self, email_data: Dict[str, Any], user_id: str) -> EmailRecord:
        """Create immutable timestamp for email (simulated Hedera integration)"""
        try:
            content_hash = self._generate_email_hash(email_data)
            
            # Simulate Hedera transaction (in real implementation, use Hedera SDK)
            simulated_transaction_id = f"0.0.{int(time.time())}"
            simulated_topic_id = "0.0.123456"
            simulated_sequence_number = int(time.time()) % 1000
            
            email_record = EmailRecord(
                user_id=user_id,
                email_data=email_data,
                content_hash=content_hash,
                hedera_transaction_id=simulated_transaction_id,
                hedera_topic_id=simulated_topic_id,
                sequence_number=simulated_sequence_number,
                metadata={"simulated": True}
            )
            
            # Store in database
            await db.email_records.insert_one(email_record.dict())
            
            return email_record
            
        except Exception as e:
            raise Exception(f"Failed to timestamp email: {str(e)}")
    
    async def verify_email_timestamp(self, email_data: Dict[str, Any], stored_hash: str) -> bool:
        """Verify email against existing timestamp"""
        try:
            current_hash = self._generate_email_hash(email_data)
            return current_hash == stored_hash
        except Exception as e:
            raise Exception(f"Failed to verify email timestamp: {str(e)}")

# Initialize services
wallet_auth_service = WalletAuthService()
email_timestamp_service = EmailTimestampService()

# Dependency for authentication
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Extract current user from JWT token"""
    token = credentials.credentials
    return wallet_auth_service.verify_token(token)

# Routes
@api_router.get("/")
async def root():
    return {"message": "Web3 Email Platform API"}

@api_router.get("/health")
async def health_check():
    """API health check"""
    return {
        "status": "healthy",
        "network": "testnet",
        "timestamp": int(time.time())
    }

# Authentication endpoints
@api_router.post("/auth/challenge", response_model=AuthChallengeResponse)
async def create_auth_challenge(request: AuthChallengeRequest):
    """Create authentication challenge for wallet signing"""
    try:
        challenge = wallet_auth_service.create_authentication_challenge(
            request.wallet_address
        )
        return AuthChallengeResponse(**challenge)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create authentication challenge: {str(e)}"
        )

@api_router.post("/auth/verify")
async def verify_wallet_signature(request: AuthSignRequest):
    """Verify wallet signature and create session"""
    try:
        auth_result = await wallet_auth_service.authenticate_wallet(
            wallet_address=request.wallet_address,
            signature=request.signature,
            challenge_data=request.challenge_data,
            wallet_type=request.wallet_type
        )
        return auth_result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication verification failed: {str(e)}"
        )

# Email endpoints
@api_router.post("/emails/timestamp")
async def timestamp_email(
    request: EmailTimestampRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create immutable timestamp for email using HCS"""
    try:
        timestamp_result = await email_timestamp_service.timestamp_email(
            email_data=request.email_data.dict(),
            user_id=current_user["user_id"]
        )
        
        return {
            "success": True,
            "timestamp": {
                "email_id": timestamp_result.id,
                "content_hash": timestamp_result.content_hash,
                "hedera_transaction_id": timestamp_result.hedera_transaction_id,
                "hedera_topic_id": timestamp_result.hedera_topic_id,
                "sequence_number": timestamp_result.sequence_number,
                "timestamp": timestamp_result.timestamp.isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to timestamp email: {str(e)}"
        )

@api_router.post("/emails/verify")
async def verify_email_timestamp(
    email_data: EmailData,
    stored_hash: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Verify email against existing timestamp"""
    try:
        is_valid = await email_timestamp_service.verify_email_timestamp(
            email_data=email_data.dict(),
            stored_hash=stored_hash
        )
        
        return {
            "valid": is_valid,
            "verification_timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify email timestamp: {str(e)}"
        )

@api_router.get("/emails/user")
async def get_user_emails(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's email records"""
    try:
        email_records = await db.email_records.find(
            {"user_id": current_user["user_id"]}
        ).to_list(100)
        
        return {
            "emails": [EmailRecord(**record) for record in email_records],
            "count": len(email_records)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user emails: {str(e)}"
        )

# Legacy routes for compatibility
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()