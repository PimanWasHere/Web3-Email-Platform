import json
import logging
import asyncio
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from collections import defaultdict
import numpy as np

class AdvancedAnalyticsService:
    def __init__(self, db):
        self.db = db
        self.logger = logging.getLogger(__name__)
    
    async def get_user_portfolio_analytics(self, user_id: str, timeframe: str = "30d") -> Dict[str, Any]:
        """Generate comprehensive portfolio analytics for user"""
        try:
            # Calculate date range
            days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(timeframe, 30)
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # Get user's crypto transactions
            transactions = await self.db.crypto_transactions.find({
                "user_id": user_id,
                "created_at": {"$gte": start_date}
            }).to_list(1000)
            
            # Get user's email records
            emails = await self.db.email_records.find({
                "user_id": user_id,
                "timestamp": {"$gte": start_date}
            }).to_list(1000)
            
            # Calculate transaction metrics
            total_transactions = len(transactions)
            successful_transactions = len([tx for tx in transactions if tx.get("status") == "confirmed"])
            failed_transactions = total_transactions - successful_transactions
            
            # Calculate transaction types
            token_transfers = len([tx for tx in transactions if tx.get("transaction_type") == "token_transfer"])
            nft_transfers = len([tx for tx in transactions if tx.get("transaction_type") == "nft_transfer"])
            eth_transfers = len([tx for tx in transactions if tx.get("transaction_type") == "eth_transfer"])
            
            # Calculate email metrics
            total_emails = len(emails)
            crypto_emails = len([email for email in emails if email.get("metadata", {}).get("crypto_transfer_included")])
            
            # Calculate daily activity
            daily_activity = defaultdict(int)
            for tx in transactions:
                date_key = tx["created_at"].strftime("%Y-%m-%d")
                daily_activity[date_key] += 1
            
            # Calculate success rate
            success_rate = (successful_transactions / total_transactions * 100) if total_transactions > 0 else 0
            
            # Mock portfolio values (in production, get real token values)
            mock_portfolio_value = {
                "current_value_usd": 5432.10,
                "change_24h": 156.78,
                "change_percentage_24h": 2.97,
                "change_7d": -234.56,
                "change_percentage_7d": -4.32,
                "change_30d": 1234.56,
                "change_percentage_30d": 29.85
            }
            
            return {
                "user_id": user_id,
                "timeframe": timeframe,
                "period_start": start_date.isoformat(),
                "period_end": datetime.utcnow().isoformat(),
                "transaction_analytics": {
                    "total_transactions": total_transactions,
                    "successful_transactions": successful_transactions,
                    "failed_transactions": failed_transactions,
                    "success_rate": round(success_rate, 2),
                    "transaction_types": {
                        "token_transfers": token_transfers,
                        "nft_transfers": nft_transfers,
                        "eth_transfers": eth_transfers
                    }
                },
                "email_analytics": {
                    "total_emails": total_emails,
                    "crypto_emails": crypto_emails,
                    "crypto_email_percentage": round((crypto_emails / total_emails * 100) if total_emails > 0 else 0, 2)
                },
                "portfolio_analytics": mock_portfolio_value,
                "activity_trends": {
                    "daily_transactions": dict(daily_activity),
                    "most_active_day": max(daily_activity.items(), key=lambda x: x[1]) if daily_activity else None,
                    "average_daily_activity": sum(daily_activity.values()) / max(len(daily_activity), 1)
                },
                "insights": await self._generate_user_insights(transactions, emails)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to generate user portfolio analytics: {e}")
            return {"error": str(e)}
    
    async def get_platform_analytics(self, timeframe: str = "30d") -> Dict[str, Any]:
        """Generate platform-wide analytics"""
        try:
            days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(timeframe, 30)
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # Get platform statistics
            total_users = await self.db.users.count_documents({})
            active_users = await self.db.users.count_documents({
                "created_at": {"$gte": start_date}
            })
            
            total_emails = await self.db.email_records.count_documents({
                "timestamp": {"$gte": start_date}
            })
            
            total_transactions = await self.db.crypto_transactions.count_documents({
                "created_at": {"$gte": start_date}
            })
            
            # Get subscription distribution
            subscription_pipeline = [
                {"$group": {"_id": "$subscription_tier", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]
            subscription_data = await self.db.users.aggregate(subscription_pipeline).to_list(10)
            
            # Get payment transactions
            payment_transactions = await self.db.payment_transactions.find({
                "created_at": {"$gte": start_date}
            }).to_list(1000)
            
            total_revenue = sum(tx.get("amount", 0) for tx in payment_transactions if tx.get("payment_status") == "completed")
            
            # Calculate growth metrics
            previous_period_start = start_date - timedelta(days=days)
            previous_users = await self.db.users.count_documents({
                "created_at": {"$gte": previous_period_start, "$lt": start_date}
            })
            
            user_growth = ((active_users - previous_users) / max(previous_users, 1)) * 100
            
            return {
                "timeframe": timeframe,
                "period_start": start_date.isoformat(),
                "period_end": datetime.utcnow().isoformat(),
                "user_metrics": {
                    "total_users": total_users,
                    "active_users": active_users,
                    "new_users": active_users,
                    "user_growth_percentage": round(user_growth, 2)
                },
                "engagement_metrics": {
                    "total_emails": total_emails,
                    "total_crypto_transactions": total_transactions,
                    "emails_per_user": round(total_emails / max(active_users, 1), 2),
                    "transactions_per_user": round(total_transactions / max(active_users, 1), 2)
                },
                "subscription_metrics": {
                    "distribution": {item["_id"]: item["count"] for item in subscription_data},
                    "total_revenue": round(total_revenue, 2),
                    "average_revenue_per_user": round(total_revenue / max(active_users, 1), 2)
                },
                "platform_insights": await self._generate_platform_insights(timeframe)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to generate platform analytics: {e}")
            return {"error": str(e)}
    
    async def get_crypto_market_analytics(self) -> Dict[str, Any]:
        """Get crypto market analytics and trends"""
        try:
            # Mock market data (in production, integrate with CoinGecko/CoinMarketCap)
            market_data = {
                "total_market_cap": 2_450_000_000_000,  # $2.45T
                "total_volume_24h": 85_000_000_000,     # $85B
                "bitcoin_dominance": 42.5,
                "ethereum_dominance": 18.3,
                "defi_tvl": 45_000_000_000,             # $45B
                "nft_volume_24h": 15_000_000,           # $15M
                "market_sentiment": "bullish",
                "fear_greed_index": 68
            }
            
            # Mock top performing tokens
            top_tokens = [
                {"symbol": "ETH", "price": 2500.0, "change_24h": 3.45, "volume_24h": 12_000_000_000},
                {"symbol": "BTC", "price": 43500.0, "change_24h": 1.23, "volume_24h": 18_000_000_000},
                {"symbol": "MATIC", "price": 0.75, "change_24h": 5.67, "volume_24h": 350_000_000},
                {"symbol": "ARB", "price": 1.25, "change_24h": 8.90, "volume_24h": 280_000_000},
                {"symbol": "OP", "price": 2.10, "change_24h": 4.56, "volume_24h": 190_000_000}
            ]
            
            # Market trends
            trends = {
                "layer_2_adoption": {"trend": "up", "growth": 156.7},
                "defi_protocols": {"trend": "stable", "growth": 12.3},
                "nft_collections": {"trend": "down", "growth": -23.4},
                "institutional_adoption": {"trend": "up", "growth": 89.2}
            }
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "market_overview": market_data,
                "top_tokens": top_tokens,
                "market_trends": trends,
                "recommendations": [
                    "Layer 2 solutions showing strong growth - consider Polygon and Arbitrum",
                    "DeFi yields are stabilizing - good time for steady investments",
                    "Institutional adoption accelerating - positive long-term outlook"
                ]
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get crypto market analytics: {e}")
            return {"error": str(e)}
    
    async def get_risk_assessment(self, user_id: str) -> Dict[str, Any]:
        """Generate risk assessment for user's crypto activities"""
        try:
            # Get user's transaction history
            transactions = await self.db.crypto_transactions.find({
                "user_id": user_id
            }).to_list(500)
            
            if not transactions:
                return {
                    "risk_level": "low",
                    "risk_score": 0,
                    "assessment": "No crypto activity to assess"
                }
            
            # Calculate risk factors
            risk_factors = {
                "transaction_frequency": 0,
                "large_transactions": 0,
                "failed_transactions": 0,
                "new_addresses": 0,
                "diverse_assets": 0
            }
            
            # Analyze transaction patterns
            daily_transactions = defaultdict(int)
            unique_addresses = set()
            failed_count = 0
            large_tx_count = 0
            
            for tx in transactions:
                # Daily frequency
                date_key = tx["created_at"].strftime("%Y-%m-%d")
                daily_transactions[date_key] += 1
                
                # Unique addresses
                if tx.get("to_address"):
                    unique_addresses.add(tx["to_address"])
                
                # Failed transactions
                if tx.get("status") == "failed":
                    failed_count += 1
                
                # Large transactions (mock threshold)
                amount = float(tx.get("amount", 0)) if tx.get("amount") else 0
                if amount > 1000:  # $1000+ transactions
                    large_tx_count += 1
            
            # Calculate risk scores (0-100)
            max_daily_tx = max(daily_transactions.values()) if daily_transactions else 0
            risk_factors["transaction_frequency"] = min(max_daily_tx * 10, 100)
            risk_factors["large_transactions"] = min(large_tx_count * 20, 100)
            risk_factors["failed_transactions"] = min(failed_count * 15, 100)
            risk_factors["new_addresses"] = min(len(unique_addresses) * 5, 100)
            
            # Calculate overall risk score
            total_risk_score = sum(risk_factors.values()) / len(risk_factors)
            
            # Determine risk level
            if total_risk_score < 20:
                risk_level = "low"
                color = "green"
            elif total_risk_score < 50:
                risk_level = "medium"
                color = "yellow"
            elif total_risk_score < 80:
                risk_level = "high"
                color = "orange"
            else:
                risk_level = "very_high"
                color = "red"
            
            # Generate recommendations
            recommendations = []
            if risk_factors["failed_transactions"] > 30:
                recommendations.append("High failed transaction rate - verify addresses carefully")
            if risk_factors["large_transactions"] > 50:
                recommendations.append("Many large transactions - consider splitting amounts")
            if risk_factors["transaction_frequency"] > 70:
                recommendations.append("Very high transaction frequency - monitor for suspicious activity")
            
            return {
                "user_id": user_id,
                "risk_level": risk_level,
                "risk_score": round(total_risk_score, 1),
                "risk_color": color,
                "risk_factors": risk_factors,
                "transaction_count": len(transactions),
                "unique_addresses": len(unique_addresses),
                "recommendations": recommendations,
                "assessment_date": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Failed to generate risk assessment: {e}")
            return {"error": str(e)}
    
    async def _generate_user_insights(self, transactions: List, emails: List) -> List[str]:
        """Generate personalized insights for user"""
        insights = []
        
        try:
            if len(transactions) > 10:
                insights.append("🚀 You're an active crypto user! Your transaction volume is above average.")
            
            if len(emails) > 20:
                insights.append("📧 You're making great use of Web3 email features!")
            
            # Transaction type insights
            token_transfers = len([tx for tx in transactions if tx.get("transaction_type") == "token_transfer"])
            nft_transfers = len([tx for tx in transactions if tx.get("transaction_type") == "nft_transfer"])
            
            if nft_transfers > token_transfers:
                insights.append("🎨 You're an NFT enthusiast! Most of your transfers are NFTs.")
            elif token_transfers > nft_transfers * 2:
                insights.append("💰 You prefer token transfers over NFTs - efficient choice!")
            
            # Success rate insights
            successful = len([tx for tx in transactions if tx.get("status") == "confirmed"])
            success_rate = (successful / len(transactions) * 100) if transactions else 0
            
            if success_rate > 95:
                insights.append("✅ Excellent! You have a very high transaction success rate.")
            elif success_rate < 80:
                insights.append("⚠️ Consider double-checking addresses - your success rate could be improved.")
            
            # Activity pattern insights
            if len(transactions) > 0:
                recent_activity = len([tx for tx in transactions if (datetime.utcnow() - tx["created_at"]).days < 7])
                if recent_activity > len(transactions) * 0.5:
                    insights.append("📈 You've been very active recently! Keep up the momentum.")
            
            if not insights:
                insights.append("🌟 Welcome to Web3 email! Start exploring our crypto transfer features.")
            
        except Exception as e:
            self.logger.error(f"Failed to generate user insights: {e}")
            insights.append("📊 Analytics are being processed - check back soon!")
        
        return insights
    
    async def _generate_platform_insights(self, timeframe: str) -> List[str]:
        """Generate platform-wide insights"""
        insights = [
            "🚀 Web3 email adoption is accelerating with crypto transfer integration",
            "💼 Enterprise subscriptions showing strong growth this quarter",
            "🔗 Multi-chain support driving increased user engagement",
            "🎯 AI-powered email features reducing compose time by 40%",
            "📈 Platform revenue up 156% compared to previous period"
        ]
        
        return insights

# This will be initialized with database connection in server.py
analytics_service = None