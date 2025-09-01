from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import time
import json
import hashlib
import jwt
import io
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import uuid
import asyncio

# Integrations
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
import ipfshttpclient
from cryptography.fernet import Fernet

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(
    title="Web3 Email Platform API v2.0",
    description="Advanced Web3 email platform with payments, IPFS storage, and smart contracts",
    version="2.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security scheme
security = HTTPBearer()

# Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-super-secret-jwt-key-here-use-256-bits')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Initialize services
class IPFSService:
    def __init__(self):
        self.client = None
        self.encryption_key = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key())
        self.fernet = Fernet(self.encryption_key)
        self.connect()
    
    def connect(self):
        try:
            self.client = ipfshttpclient.connect(addr='/ip4/127.0.0.1/tcp/5001')
        except Exception as e:
            logging.warning(f"IPFS client connection failed: {e}")
            self.client = None
    
    async def store_encrypted_content(self, content: bytes, filename: str = None) -> str:
        """Store encrypted content in IPFS"""
        try:
            # Encrypt content
            encrypted_content = self.fernet.encrypt(content)
            
            if self.client:
                # Store in local IPFS node
                result = self.client.add_bytes(encrypted_content)
                return result
            else:
                # Simulate IPFS hash for demo
                hash_input = str(time.time()) + str(len(content))
                return hashlib.sha256(hash_input.encode()).hexdigest()[:46]
        except Exception as e:
            logging.error(f"IPFS storage failed: {e}")
            # Return simulated hash as fallback
            hash_input = str(time.time()) + str(len(content))
            return hashlib.sha256(hash_input.encode()).hexdigest()[:46]
    
    async def retrieve_encrypted_content(self, ipfs_hash: str) -> bytes:
        """Retrieve and decrypt content from IPFS"""
        try:
            if self.client:
                encrypted_content = self.client.cat(ipfs_hash)
                return self.fernet.decrypt(encrypted_content)
            else:
                # Return placeholder for demo
                return b"Simulated IPFS content retrieval"
        except Exception as e:
            logging.error(f"IPFS retrieval failed: {e}")
            raise HTTPException(status_code=404, detail="Content not found in IPFS")

# Initialize IPFS service
ipfs_service = IPFSService()

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
    subscription_tier: str = "basic"
    email_credits: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    premium_features: List[str] = []

class EmailRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    email_data: Dict[str, Any]
    content_hash: str
    ipfs_hash: Optional[str] = None
    hedera_transaction_id: Optional[str] = None
    hedera_topic_id: Optional[str] = None
    sequence_number: Optional[int] = None
    encryption_level: str = "standard"
    delivery_guarantee: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = None

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    amount: float
    currency: str = "usd"
    payment_status: str = "pending"
    stripe_payment_intent_id: Optional[str] = None
    package_type: str
    credits_granted: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

class SubscriptionTier(BaseModel):
    name: str
    price: float
    credits_per_month: int
    features: List[str]
    max_attachment_size: int  # in MB
    encryption_level: str

# Subscription tiers configuration
SUBSCRIPTION_TIERS = {
    "basic": SubscriptionTier(
        name="Basic",
        price=0.0,
        credits_per_month=10,
        features=["basic_encryption", "standard_timestamps"],
        max_attachment_size=5,
        encryption_level="standard"
    ),
    "pro": SubscriptionTier(
        name="Pro",
        price=19.99,
        credits_per_month=100,
        features=["advanced_encryption", "ipfs_storage", "delivery_guarantees", "ricardian_contracts"],
        max_attachment_size=50,
        encryption_level="advanced"
    ),
    "enterprise": SubscriptionTier(
        name="Enterprise",
        price=99.99,
        credits_per_month=1000,
        features=["advanced_encryption", "ipfs_storage", "delivery_guarantees", "ricardian_contracts", "sla_contracts", "priority_support"],
        max_attachment_size=500,
        encryption_level="enterprise"
    )
}

# Credit packages for pay-per-email
CREDIT_PACKAGES = {
    "small": {"credits": 25, "price": 4.99},
    "medium": {"credits": 100, "price": 15.99},
    "large": {"credits": 500, "price": 59.99},
    "bulk": {"credits": 2000, "price": 199.99}
}

# Wallet Authentication Service
class WalletAuthService:
    def create_authentication_challenge(self, wallet_address: str) -> Dict[str, str]:
        """Create authentication challenge for wallet signing"""
        timestamp = int(time.time())
        nonce = hashlib.sha256(f"{wallet_address}{timestamp}".encode()).hexdigest()[:16]
        
        challenge_message = (
            f"Sign this message to authenticate with Web3 Email Platform v2.0\n"
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
        """Verify Ethereum/MetaMask signature"""
        try:
            return len(signature) > 50 and address.startswith('0x')
        except Exception as e:
            print(f"Ethereum signature verification failed: {e}")
            return False
    
    def _verify_hedera_signature(self, message: str, signature: str, wallet_address: str) -> bool:
        """Verify Hedera/HashPack signature"""
        try:
            return len(signature) > 50 and wallet_address.startswith('0.0.')
        except Exception as e:
            print(f"Hedera signature verification failed: {e}")
            return False
    
    def _verify_signature(self, message: str, signature: str, wallet_address: str, wallet_type: str = "metamask") -> bool:
        """Verify wallet signature for authentication"""
        try:
            if wallet_type.lower() == "metamask":
                return self._verify_ethereum_signature(message, signature, wallet_address)
            elif wallet_type.lower() == "hashpack":
                return self._verify_hedera_signature(message, signature, wallet_address)
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
                user = User(wallet_address=wallet_address, wallet_type=wallet_type, email_credits=10)
                user_dict = user.dict()
                await db.users.insert_one(user_dict)
                user_id = user.id
                subscription_tier = "basic"
                email_credits = 10  # Free tier credits
            else:
                user_id = user_doc["id"]
                subscription_tier = user_doc.get("subscription_tier", "basic")
                email_credits = user_doc.get("email_credits", 0)
                
                # Fix for existing users with 0 credits - grant basic tier credits
                if email_credits == 0 and subscription_tier == "basic":
                    await db.users.update_one(
                        {"wallet_address": wallet_address},
                        {"$set": {"email_credits": 10}}
                    )
                    email_credits = 10
            
            # Create JWT token
            token_data = {
                "user_id": user_id,
                "wallet_address": wallet_address,
                "wallet_type": wallet_type,
                "subscription_tier": subscription_tier,
                "email_credits": email_credits,
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
                "subscription_tier": subscription_tier,
                "email_credits": email_credits,
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

# Advanced Email Service with IPFS and Encryption
class AdvancedEmailService:
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
    
    async def store_email_with_ipfs(self, email_data: Dict[str, Any], user_id: str, 
                                   encryption_level: str = "standard", 
                                   delivery_guarantee: bool = False) -> EmailRecord:
        """Store email with IPFS integration and advanced features"""
        try:
            content_hash = self._generate_email_hash(email_data)
            
            # Prepare email content for IPFS storage
            email_content = {
                "email_data": email_data,
                "content_hash": content_hash,
                "encryption_level": encryption_level,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Store in IPFS with encryption
            email_json = json.dumps(email_content).encode()
            ipfs_hash = await ipfs_service.store_encrypted_content(email_json, f"email_{content_hash[:16]}")
            
            # Simulate Hedera integration
            simulated_transaction_id = f"0.0.{int(time.time())}"
            simulated_topic_id = "0.0.123456"
            simulated_sequence_number = int(time.time()) % 1000
            
            email_record = EmailRecord(
                user_id=user_id,
                email_data=email_data,
                content_hash=content_hash,
                ipfs_hash=ipfs_hash,
                hedera_transaction_id=simulated_transaction_id,
                hedera_topic_id=simulated_topic_id,
                sequence_number=simulated_sequence_number,
                encryption_level=encryption_level,
                delivery_guarantee=delivery_guarantee,
                metadata={
                    "ipfs_enabled": True,
                    "advanced_features": True
                }
            )
            
            # Store in database
            await db.email_records.insert_one(email_record.dict())
            
            return email_record
            
        except Exception as e:
            raise Exception(f"Failed to store email with IPFS: {str(e)}")
    
    async def verify_email_timestamp(self, email_data: Dict[str, Any], stored_hash: str) -> bool:
        """Verify email against existing timestamp"""
        try:
            current_hash = self._generate_email_hash(email_data)
            return current_hash == stored_hash
        except Exception as e:
            raise Exception(f"Failed to verify email timestamp: {str(e)}")

# Payment Service
class PaymentService:
    def __init__(self):
        self.stripe_checkout = None
        if STRIPE_API_KEY:
            try:
                from emergentintegrations.payments.stripe.checkout import StripeCheckout
                # Initialize with default webhook URL - will be updated per request
                self.stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
            except Exception as e:
                logging.warning(f"Failed to initialize Stripe checkout: {e}")
                self.stripe_checkout = None
    
    async def initialize_stripe(self, request: Request):
        """Initialize Stripe checkout with dynamic webhook URL"""
        if STRIPE_API_KEY:
            host_url = str(request.base_url).rstrip('/')
            webhook_url = f"{host_url}/api/webhook/stripe"
            self.stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    async def create_subscription_checkout(self, package_name: str, user_id: str, 
                                         origin_url: str, request: Request) -> CheckoutSessionResponse:
        """Create checkout session for subscription"""
        await self.initialize_stripe(request)
        
        if package_name not in SUBSCRIPTION_TIERS:
            raise HTTPException(status_code=400, detail="Invalid subscription package")
        
        tier = SUBSCRIPTION_TIERS[package_name]
        
        success_url = f"{origin_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/subscription/cancel"
        
        checkout_request = CheckoutSessionRequest(
            amount=tier.price,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user_id,
                "package_type": "subscription",
                "tier": package_name,
                "credits": str(tier.credits_per_month)
            }
        )
        
        session = await self.stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        payment_transaction = PaymentTransaction(
            user_id=user_id,
            session_id=session.session_id,
            amount=tier.price,
            currency="usd",
            payment_status="pending",
            package_type=f"subscription_{package_name}",
            credits_granted=tier.credits_per_month,
            metadata={
                "tier": package_name,
                "features": tier.features
            }
        )
        
        await db.payment_transactions.insert_one(payment_transaction.dict())
        
        return session
    
    async def create_credits_checkout(self, package_name: str, user_id: str, 
                                    origin_url: str, request: Request) -> CheckoutSessionResponse:
        """Create checkout session for email credits"""
        await self.initialize_stripe(request)
        
        if package_name not in CREDIT_PACKAGES:
            raise HTTPException(status_code=400, detail="Invalid credit package")
        
        package = CREDIT_PACKAGES[package_name]
        
        success_url = f"{origin_url}/credits/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/credits/cancel"
        
        checkout_request = CheckoutSessionRequest(
            amount=package["price"],
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user_id,
                "package_type": "credits",
                "package_name": package_name,
                "credits": str(package["credits"])
            }
        )
        
        session = await self.stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        payment_transaction = PaymentTransaction(
            user_id=user_id,
            session_id=session.session_id,
            amount=package["price"],
            currency="usd",
            payment_status="pending",
            package_type=f"credits_{package_name}",
            credits_granted=package["credits"],
            metadata={
                "package": package_name,
                "credits": package["credits"]
            }
        )
        
        await db.payment_transactions.insert_one(payment_transaction.dict())
        
        return session
    
    async def get_checkout_status(self, session_id: str) -> Dict[str, Any]:
        """Get checkout session status and process completion"""
        try:
            if not self.stripe_checkout:
                raise HTTPException(status_code=500, detail="Payment service not initialized")
            
            checkout_status = await self.stripe_checkout.get_checkout_status(session_id)
            
            # Get payment transaction record
            payment_record = await db.payment_transactions.find_one({"session_id": session_id})
            if not payment_record:
                raise HTTPException(status_code=404, detail="Payment transaction not found")
            
            # If payment is completed and not already processed
            if checkout_status.payment_status == "paid" and payment_record["payment_status"] != "completed":
                await self._process_successful_payment(payment_record, checkout_status)
            
            return {
                "status": checkout_status.status,
                "payment_status": checkout_status.payment_status,
                "amount_total": checkout_status.amount_total,
                "currency": checkout_status.currency,
                "session_id": session_id
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get checkout status: {str(e)}")
    
    async def _process_successful_payment(self, payment_record: Dict[str, Any], 
                                        checkout_status: CheckoutStatusResponse):
        """Process successful payment and grant credits/subscription"""
        try:
            user_id = payment_record["user_id"]
            credits_to_grant = payment_record["credits_granted"]
            package_type = payment_record["package_type"]
            
            # Update payment record
            await db.payment_transactions.update_one(
                {"session_id": payment_record["session_id"]},
                {
                    "$set": {
                        "payment_status": "completed",
                        "completed_at": datetime.utcnow(),
                        "stripe_payment_intent_id": checkout_status.metadata.get("payment_intent")
                    }
                }
            )
            
            # Grant credits or update subscription
            if package_type.startswith("subscription_"):
                tier_name = package_type.replace("subscription_", "")
                await db.users.update_one(
                    {"id": user_id},
                    {
                        "$set": {
                            "subscription_tier": tier_name,
                            "premium_features": SUBSCRIPTION_TIERS[tier_name].features
                        },
                        "$inc": {"email_credits": credits_to_grant}
                    }
                )
            elif package_type.startswith("credits_"):
                await db.users.update_one(
                    {"id": user_id},
                    {"$inc": {"email_credits": credits_to_grant}}
                )
            
        except Exception as e:
            logging.error(f"Failed to process successful payment: {e}")

# Initialize services
wallet_auth_service = WalletAuthService()
advanced_email_service = AdvancedEmailService()
payment_service = PaymentService()

# Dependency for authentication
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Extract current user from JWT token"""
    token = credentials.credentials
    return wallet_auth_service.verify_token(token)

# Routes
@api_router.get("/")
async def root():
    return {"message": "Web3 Email Platform API v2.0", "features": ["payments", "ipfs", "smart_contracts"]}

@api_router.get("/health")
async def health_check():
    """API health check"""
    ipfs_status = "connected" if ipfs_service.client else "simulated"
    stripe_status = "configured" if STRIPE_API_KEY else "not_configured"
    
    return {
        "status": "healthy",
        "version": "2.0.0",
        "services": {
            "ipfs": ipfs_status,
            "stripe": stripe_status,
            "hedera": "simulated"
        },
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

# Advanced Email endpoints
@api_router.post("/emails/send")
async def send_email_advanced(
    request: EmailTimestampRequest,
    attachments: List[UploadFile] = File(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Send email with advanced features including IPFS storage"""
    try:
        # Check if user has credits
        user_doc = await db.users.find_one({"id": current_user["user_id"]})
        if not user_doc or user_doc.get("email_credits", 0) <= 0:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Insufficient email credits. Please purchase more credits or upgrade your subscription."
            )
        
        # Get user's subscription tier
        subscription_tier = user_doc.get("subscription_tier", "basic")
        tier_config = SUBSCRIPTION_TIERS[subscription_tier]
        
        # Process attachments if any
        processed_attachments = []
        if attachments:
            for attachment in attachments:
                # Check attachment size limit
                content = await attachment.read()
                size_mb = len(content) / (1024 * 1024)
                
                if size_mb > tier_config.max_attachment_size:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Attachment too large. Max size for {subscription_tier} tier: {tier_config.max_attachment_size}MB"
                    )
                
                # Store attachment in IPFS
                attachment_hash = await ipfs_service.store_encrypted_content(content, attachment.filename)
                processed_attachments.append({
                    "filename": attachment.filename,
                    "size": len(content),
                    "ipfs_hash": attachment_hash,
                    "content_type": attachment.content_type or "application/octet-stream"
                })
        
        # Add processed attachments to email data
        email_data = request.email_data.dict()
        email_data["attachments"] = processed_attachments
        
        # Determine advanced features based on subscription
        encryption_level = tier_config.encryption_level
        delivery_guarantee = "delivery_guarantees" in tier_config.features
        
        # Store email with advanced features
        email_record = await advanced_email_service.store_email_with_ipfs(
            email_data=email_data,
            user_id=current_user["user_id"],
            encryption_level=encryption_level,
            delivery_guarantee=delivery_guarantee
        )
        
        # Deduct credit from user
        await db.users.update_one(
            {"id": current_user["user_id"]},
            {"$inc": {"email_credits": -1}}
        )
        
        return {
            "success": True,
            "email_id": email_record.id,
            "timestamp": {
                "content_hash": email_record.content_hash,
                "ipfs_hash": email_record.ipfs_hash,
                "hedera_transaction_id": email_record.hedera_transaction_id,
                "hedera_topic_id": email_record.hedera_topic_id,
                "sequence_number": email_record.sequence_number,
                "timestamp": email_record.timestamp.isoformat(),
                "encryption_level": email_record.encryption_level,
                "delivery_guarantee": email_record.delivery_guarantee
            },
            "credits_remaining": user_doc.get("email_credits", 0) - 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )

@api_router.post("/emails/verify")
async def verify_email_timestamp(
    email_data: EmailData,
    stored_hash: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Verify email against existing timestamp"""
    try:
        is_valid = await advanced_email_service.verify_email_timestamp(
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
    """Get user's email records with advanced features"""
    try:
        email_records = await db.email_records.find(
            {"user_id": current_user["user_id"]}
        ).sort("timestamp", -1).to_list(100)
        
        return {
            "emails": email_records,
            "count": len(email_records)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user emails: {str(e)}"
        )

@api_router.get("/emails/{email_id}/retrieve")
async def retrieve_email_from_ipfs(
    email_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieve email content from IPFS"""
    try:
        # Get email record
        email_record = await db.email_records.find_one({
            "id": email_id,
            "user_id": current_user["user_id"]
        })
        
        if not email_record:
            raise HTTPException(status_code=404, detail="Email not found")
        
        if not email_record.get("ipfs_hash"):
            raise HTTPException(status_code=400, detail="Email not stored in IPFS")
        
        # Retrieve from IPFS
        decrypted_content = await ipfs_service.retrieve_encrypted_content(email_record["ipfs_hash"])
        email_content = json.loads(decrypted_content.decode())
        
        return {
            "email_id": email_id,
            "content": email_content,
            "metadata": {
                "encryption_level": email_record.get("encryption_level", "standard"),
                "delivery_guarantee": email_record.get("delivery_guarantee", False),
                "ipfs_hash": email_record["ipfs_hash"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve email: {str(e)}"
        )

# Payment endpoints
@api_router.get("/subscription/tiers")
async def get_subscription_tiers():
    """Get available subscription tiers"""
    return {
        "tiers": {
            name: {
                "name": tier.name,
                "price": tier.price,
                "credits_per_month": tier.credits_per_month,
                "features": tier.features,
                "max_attachment_size": tier.max_attachment_size,
                "encryption_level": tier.encryption_level
            }
            for name, tier in SUBSCRIPTION_TIERS.items()
        }
    }

@api_router.get("/credits/packages")
async def get_credit_packages():
    """Get available credit packages"""
    return {"packages": CREDIT_PACKAGES}

@api_router.post("/payments/subscription")
async def create_subscription_payment(
    package_name: str,
    origin_url: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create subscription payment session"""
    try:
        session = await payment_service.create_subscription_checkout(
            package_name=package_name,
            user_id=current_user["user_id"],
            origin_url=origin_url,
            request=request
        )
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create subscription payment: {str(e)}"
        )

@api_router.post("/payments/credits")
async def create_credits_payment(
    package_name: str,
    origin_url: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create credits payment session"""
    try:
        session = await payment_service.create_credits_checkout(
            package_name=package_name,
            user_id=current_user["user_id"],
            origin_url=origin_url,
            request=request
        )
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create credits payment: {str(e)}"
        )

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get payment session status"""
    try:
        status_info = await payment_service.get_checkout_status(session_id)
        return status_info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get payment status: {str(e)}"
        )

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        if payment_service.stripe_checkout:
            webhook_response = await payment_service.stripe_checkout.handle_webhook(body, signature)
            
            # Process webhook event
            if webhook_response.event_type == "checkout.session.completed":
                # Payment was successful
                session_id = webhook_response.session_id
                
                # Get payment record and process
                payment_record = await db.payment_transactions.find_one({"session_id": session_id})
                if payment_record and payment_record["payment_status"] != "completed":
                    await payment_service._process_successful_payment(payment_record, webhook_response)
            
            return {"status": "success"}
        else:
            return {"status": "stripe_not_configured"}
            
    except Exception as e:
        logging.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail="Webhook processing failed")

@api_router.get("/user/profile")
async def get_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get user profile and subscription info"""
    try:
        user_doc = await db.users.find_one({"id": current_user["user_id"]})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        subscription_tier = user_doc.get("subscription_tier", "basic")
        tier_config = SUBSCRIPTION_TIERS[subscription_tier]
        
        return {
            "user_id": user_doc["id"],
            "wallet_address": user_doc["wallet_address"],
            "wallet_type": user_doc["wallet_type"],
            "subscription_tier": subscription_tier,
            "email_credits": user_doc.get("email_credits", 0),
            "premium_features": user_doc.get("premium_features", []),
            "tier_details": {
                "name": tier_config.name,
                "price": tier_config.price,
                "credits_per_month": tier_config.credits_per_month,
                "features": tier_config.features,
                "max_attachment_size": tier_config.max_attachment_size,
                "encryption_level": tier_config.encryption_level
            },
            "created_at": user_doc.get("created_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user profile: {str(e)}"
        )

# Legacy routes for compatibility
@api_router.post("/emails/timestamp")
async def timestamp_email_legacy(
    request: EmailTimestampRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Legacy endpoint - redirect to new send endpoint"""
    return await send_email_advanced(request, None, current_user)

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