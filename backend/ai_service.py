import json
import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient

# AI Integration Service
class AIEmailAssistant:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def generate_email_content(self, 
                                   context: Dict[str, Any], 
                                   email_type: str = "professional") -> Dict[str, str]:
        """Generate AI-powered email content"""
        try:
            # Extract context information
            recipient = context.get('recipient', 'there')
            subject_hint = context.get('subject_hint', '')
            tone = context.get('tone', email_type)
            crypto_context = context.get('crypto_transfer', {})
            
            # Generate subject line
            if crypto_context:
                if crypto_context.get('type') == 'nft':
                    subject = f"🎨 NFT Transfer: {crypto_context.get('token_name', 'Digital Asset')}"
                else:
                    amount = crypto_context.get('amount', '0')
                    symbol = crypto_context.get('symbol', 'ETH')
                    subject = f"💰 Crypto Transfer: {amount} {symbol}"
            elif subject_hint:
                subject = f"Re: {subject_hint}"
            else:
                subject = "Important Web3 Communication"
            
            # Generate email body based on context
            if crypto_context:
                body = self._generate_crypto_email_body(recipient, crypto_context, tone)
            else:
                body = self._generate_standard_email_body(recipient, context, tone)
            
            return {
                "subject": subject,
                "body": body,
                "tone": tone,
                "confidence": 0.85
            }
            
        except Exception as e:
            self.logger.error(f"Failed to generate email content: {e}")
            return {
                "subject": "Web3 Email Communication",
                "body": f"Hello {recipient},\n\nI hope this message finds you well.\n\nBest regards",
                "tone": "professional",
                "confidence": 0.3
            }
    
    def _generate_crypto_email_body(self, recipient: str, crypto_context: Dict, tone: str) -> str:
        """Generate email body for crypto transfers"""
        transfer_type = crypto_context.get('type', 'token')
        amount = crypto_context.get('amount', '0')
        symbol = crypto_context.get('symbol', 'ETH')
        tx_hash = crypto_context.get('transaction_hash', '')
        
        if tone == "casual":
            greeting = f"Hey {recipient}!"
            closing = "Cheers!"
        elif tone == "formal":
            greeting = f"Dear {recipient},"
            closing = "Sincerely,"
        else:
            greeting = f"Hi {recipient},"
            closing = "Best regards,"
        
        if transfer_type == 'nft':
            body = f"""{greeting}

I'm excited to share that I've sent you a special NFT! 🎨

This digital collectible has been transferred to your wallet and should appear in your collection shortly. The transaction has been recorded on the blockchain for permanent verification.

Transaction Details:
• NFT: {crypto_context.get('token_name', 'Digital Asset')}
• Contract: {crypto_context.get('contract_address', 'N/A')}
• Token ID: {crypto_context.get('token_id', 'N/A')}
• Transaction Hash: {tx_hash}

You can view this transaction on Etherscan: https://etherscan.io/tx/{tx_hash}

I hope you enjoy this digital asset! Let me know when you receive it.

{closing}
"""
        else:
            body = f"""{greeting}

I've sent you a cryptocurrency transfer through our secure Web3 email platform! 💰

Transfer Details:
• Amount: {amount} {symbol}
• Transaction Hash: {tx_hash}
• Network: Ethereum
• Status: Confirmed ✅

You can view this transaction on Etherscan: https://etherscan.io/tx/{tx_hash}

The funds should appear in your wallet shortly. This transfer is cryptographically verified and permanently recorded on the blockchain.

Feel free to reach out if you have any questions about this transfer.

{closing}
"""
        
        return body
    
    def _generate_standard_email_body(self, recipient: str, context: Dict, tone: str) -> str:
        """Generate standard email body"""
        purpose = context.get('purpose', 'general communication')
        key_points = context.get('key_points', [])
        
        if tone == "casual":
            greeting = f"Hey {recipient}!"
            closing = "Talk soon!"
        elif tone == "formal":
            greeting = f"Dear {recipient},"
            closing = "Sincerely,"
        else:
            greeting = f"Hi {recipient},"
            closing = "Best regards,"
        
        body = f"""{greeting}

I hope this message finds you well.

{purpose}

"""
        
        if key_points:
            body += "Key points:\n"
            for point in key_points:
                body += f"• {point}\n"
            body += "\n"
        
        body += f"""Please let me know if you have any questions or if there's anything else I can help with.

{closing}
"""
        
        return body
    
    async def analyze_email_sentiment(self, email_content: str) -> Dict[str, Any]:
        """Analyze email sentiment and suggest improvements"""
        try:
            # Simple sentiment analysis (in production, use proper NLP models)
            positive_words = ['thank', 'great', 'excellent', 'wonderful', 'amazing', 'appreciate', 'love', 'fantastic']
            negative_words = ['sorry', 'apologize', 'mistake', 'error', 'problem', 'issue', 'concern', 'worried']
            urgent_words = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'important']
            
            email_lower = email_content.lower()
            
            positive_count = sum(1 for word in positive_words if word in email_lower)
            negative_count = sum(1 for word in negative_words if word in email_lower)
            urgent_count = sum(1 for word in urgent_words if word in email_lower)
            
            # Calculate sentiment score (-1 to 1)
            if positive_count + negative_count == 0:
                sentiment_score = 0
            else:
                sentiment_score = (positive_count - negative_count) / (positive_count + negative_count)
            
            # Determine sentiment category
            if sentiment_score > 0.3:
                sentiment = "positive"
            elif sentiment_score < -0.3:
                sentiment = "negative"
            else:
                sentiment = "neutral"
            
            # Generate suggestions
            suggestions = []
            if negative_count > positive_count:
                suggestions.append("Consider adding more positive language to improve tone")
            if urgent_count > 2:
                suggestions.append("Multiple urgent words detected - consider if all are necessary")
            if len(email_content) < 50:
                suggestions.append("Email might be too brief - consider adding more context")
            if len(email_content) > 1000:
                suggestions.append("Email is quite long - consider breaking into key points")
            
            return {
                "sentiment": sentiment,
                "sentiment_score": round(sentiment_score, 2),
                "urgency_level": "high" if urgent_count > 1 else "normal",
                "word_count": len(email_content.split()),
                "suggestions": suggestions,
                "positive_indicators": positive_count,
                "negative_indicators": negative_count,
                "urgency_indicators": urgent_count
            }
            
        except Exception as e:
            self.logger.error(f"Failed to analyze email sentiment: {e}")
            return {
                "sentiment": "neutral",
                "sentiment_score": 0,
                "urgency_level": "normal",
                "word_count": len(email_content.split()),
                "suggestions": ["Could not analyze email content"],
                "positive_indicators": 0,
                "negative_indicators": 0,
                "urgency_indicators": 0
            }
    
    async def suggest_crypto_opportunities(self, email_content: str, user_context: Dict) -> List[Dict[str, Any]]:
        """Suggest crypto-related opportunities based on email content"""
        try:
            suggestions = []
            email_lower = email_content.lower()
            
            # Detect payment-related keywords
            payment_keywords = ['payment', 'pay', 'invoice', 'bill', 'money', 'cost', 'price', 'fee']
            if any(keyword in email_lower for keyword in payment_keywords):
                suggestions.append({
                    "type": "crypto_payment",
                    "title": "💰 Consider Crypto Payment",
                    "description": "This email mentions payments. You could send cryptocurrency instead!",
                    "action": "Add crypto transfer to this email",
                    "confidence": 0.7
                })
            
            # Detect gift-related keywords
            gift_keywords = ['gift', 'present', 'birthday', 'anniversary', 'congratulations', 'celebration']
            if any(keyword in email_lower for keyword in gift_keywords):
                suggestions.append({
                    "type": "nft_gift",
                    "title": "🎁 NFT Gift Opportunity",
                    "description": "This seems like a gift occasion. Consider sending an NFT!",
                    "action": "Browse NFTs to send",
                    "confidence": 0.6
                })
            
            # Detect business/contract keywords
            business_keywords = ['contract', 'agreement', 'business', 'deal', 'proposal', 'partnership']
            if any(keyword in email_lower for keyword in business_keywords):
                suggestions.append({
                    "type": "smart_contract",
                    "title": "📋 Smart Contract Suggestion", 
                    "description": "This email discusses agreements. Consider using a smart contract!",
                    "action": "Create smart contract",
                    "confidence": 0.5
                })
            
            # Detect investment/financial keywords
            investment_keywords = ['invest', 'portfolio', 'stocks', 'trading', 'finance', 'market']
            if any(keyword in email_lower for keyword in investment_keywords):
                suggestions.append({
                    "type": "defi_opportunity",
                    "title": "📈 DeFi Opportunity",
                    "description": "Financial discussion detected. Explore DeFi opportunities!",
                    "action": "View DeFi options",
                    "confidence": 0.4
                })
            
            return suggestions
            
        except Exception as e:
            self.logger.error(f"Failed to suggest crypto opportunities: {e}")
            return []
    
    async def generate_smart_contract_template(self, contract_type: str, params: Dict[str, Any]) -> Dict[str, str]:
        """Generate smart contract templates based on email context"""
        try:
            if contract_type == "escrow":
                return {
                    "name": "Email Escrow Agreement",
                    "description": "Holds funds until email conditions are met",
                    "template": self._generate_escrow_template(params),
                    "language": "solidity"
                }
            elif contract_type == "recurring_payment":
                return {
                    "name": "Recurring Email Payment",
                    "description": "Automatic recurring payments via email",
                    "template": self._generate_recurring_payment_template(params),
                    "language": "solidity"
                }
            elif contract_type == "milestone":
                return {
                    "name": "Milestone Payment Contract",
                    "description": "Payments released on milestone completion",
                    "template": self._generate_milestone_template(params),
                    "language": "solidity"
                }
            else:
                return {
                    "name": "Basic Agreement",
                    "description": "Simple agreement template",
                    "template": self._generate_basic_template(params),
                    "language": "text"
                }
                
        except Exception as e:
            self.logger.error(f"Failed to generate smart contract template: {e}")
            return {
                "name": "Error",
                "description": "Could not generate contract template",
                "template": "// Contract generation failed",
                "language": "text"
            }
    
    def _generate_escrow_template(self, params: Dict) -> str:
        amount = params.get('amount', '1.0')
        token = params.get('token', 'ETH')
        return f"""
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EmailEscrow {{
    address public buyer;
    address public seller;
    address public arbitrator;
    uint256 public amount = {amount} ether;
    bool public released = false;
    
    constructor(address _seller) {{
        buyer = msg.sender;
        seller = _seller;
        arbitrator = 0x...; // Platform address
    }}
    
    function release() external {{
        require(msg.sender == buyer || msg.sender == arbitrator, "Not authorized");
        require(!released, "Already released");
        released = true;
        payable(seller).transfer(amount);
    }}
    
    function refund() external {{
        require(msg.sender == arbitrator, "Only arbitrator can refund");
        require(!released, "Already released");
        released = true;
        payable(buyer).transfer(amount);
    }}
}}
"""
    
    def _generate_recurring_payment_template(self, params: Dict) -> str:
        amount = params.get('amount', '1.0')
        interval = params.get('interval', '30 days')
        return f"""
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RecurringPayment {{
    address public payer;
    address public recipient;
    uint256 public amount = {amount} ether;
    uint256 public interval = 30 days;
    uint256 public lastPayment;
    
    constructor(address _recipient) {{
        payer = msg.sender;
        recipient = _recipient;
        lastPayment = block.timestamp;
    }}
    
    function makePayment() external {{
        require(block.timestamp >= lastPayment + interval, "Too early");
        require(address(this).balance >= amount, "Insufficient funds");
        
        lastPayment = block.timestamp;
        payable(recipient).transfer(amount);
    }}
    
    receive() external payable {{}}
}}
"""
    
    def _generate_milestone_template(self, params: Dict) -> str:
        milestones = params.get('milestones', ['Milestone 1', 'Milestone 2'])
        return f"""
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MilestonePayment {{
    address public client;
    address public contractor;
    uint256 public totalAmount;
    uint256 public milestonesCompleted = 0;
    uint256 public totalMilestones = {len(milestones)};
    
    mapping(uint256 => bool) public milestoneCompleted;
    
    constructor(address _contractor) payable {{
        client = msg.sender;
        contractor = _contractor;
        totalAmount = msg.value;
    }}
    
    function completeMilestone(uint256 milestoneId) external {{
        require(msg.sender == client, "Only client can confirm");
        require(!milestoneCompleted[milestoneId], "Already completed");
        
        milestoneCompleted[milestoneId] = true;
        milestonesCompleted++;
        
        uint256 payment = totalAmount / totalMilestones;
        payable(contractor).transfer(payment);
    }}
}}
"""
    
    def _generate_basic_template(self, params: Dict) -> str:
        parties = params.get('parties', ['Party A', 'Party B'])
        terms = params.get('terms', ['Term 1', 'Term 2'])
        
        template = f"""
EMAIL AGREEMENT TEMPLATE

Parties:
{chr(10).join(f"• {party}" for party in parties)}

Terms and Conditions:
{chr(10).join(f"{i+1}. {term}" for i, term in enumerate(terms))}

This agreement is created through the Web3 Email Platform and is cryptographically signed by all parties.

Signature: [To be signed via wallet]
Date: {datetime.now().strftime('%Y-%m-%d')}
Platform: Web3 Email Platform v2.0
"""
        return template

# Initialize AI service
ai_assistant = AIEmailAssistant()