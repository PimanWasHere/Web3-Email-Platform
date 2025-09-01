import json
import logging
import asyncio
from typing import Dict, List, Optional, Any, Union
from web3 import Web3
from eth_utils import to_checksum_address, is_address
import aiohttp
from datetime import datetime
import os

# Multi-Chain Configuration
CHAIN_CONFIGS = {
    "ethereum": {
        "chain_id": 1,
        "name": "Ethereum Mainnet",
        "rpc_url": "https://mainnet.infura.io/v3/demo",
        "explorer": "https://etherscan.io",
        "native_token": {"symbol": "ETH", "decimals": 18},
        "color": "#627EEA"
    },
    "polygon": {
        "chain_id": 137,
        "name": "Polygon",
        "rpc_url": "https://polygon-rpc.com",
        "explorer": "https://polygonscan.com",
        "native_token": {"symbol": "MATIC", "decimals": 18},
        "color": "#8247E5"
    },
    "arbitrum": {
        "chain_id": 42161,
        "name": "Arbitrum One",
        "rpc_url": "https://arb1.arbitrum.io/rpc",
        "explorer": "https://arbiscan.io",
        "native_token": {"symbol": "ETH", "decimals": 18},
        "color": "#28A0F0"
    },
    "optimism": {
        "chain_id": 10,
        "name": "Optimism",
        "rpc_url": "https://mainnet.optimism.io",
        "explorer": "https://optimistic.etherscan.io",
        "native_token": {"symbol": "ETH", "decimals": 18},
        "color": "#FF0420"
    },
    "bsc": {
        "chain_id": 56,
        "name": "Binance Smart Chain",
        "rpc_url": "https://bsc-dataseed1.binance.org",
        "explorer": "https://bscscan.com",
        "native_token": {"symbol": "BNB", "decimals": 18},
        "color": "#F3BA2F"
    },
    "avalanche": {
        "chain_id": 43114,
        "name": "Avalanche",
        "rpc_url": "https://api.avax.network/ext/bc/C/rpc",
        "explorer": "https://snowtrace.io",
        "native_token": {"symbol": "AVAX", "decimals": 18},
        "color": "#E84142"
    }
}

# Popular tokens on each chain
CHAIN_TOKENS = {
    "ethereum": {
        "USDC": "0xA0b86a33E6417B0F90E0Aa97dF2ED5BE4Ab3c9c6",
        "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "UNI": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
    },
    "polygon": {
        "USDC": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        "USDT": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        "DAI": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
        "WMATIC": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        "AAVE": "0xD6DF932A45C0f255f85145f286eA0b292B21C90B"
    },
    "arbitrum": {
        "USDC": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
        "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        "DAI": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        "WETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        "ARB": "0x912CE59144191C1204E64559FE8253a0e49E6548"
    }
}

class MultiChainService:
    def __init__(self):
        self.providers = {}
        self.logger = logging.getLogger(__name__)
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize Web3 providers for all supported chains"""
        for chain_name, config in CHAIN_CONFIGS.items():
            try:
                provider = Web3(Web3.HTTPProvider(config["rpc_url"]))
                self.providers[chain_name] = provider
                self.logger.info(f"Initialized {chain_name} provider")
            except Exception as e:
                self.logger.error(f"Failed to initialize {chain_name} provider: {e}")
                self.providers[chain_name] = None
    
    def get_supported_chains(self) -> List[Dict[str, Any]]:
        """Get list of all supported blockchain networks"""
        chains = []
        for chain_name, config in CHAIN_CONFIGS.items():
            chains.append({
                "id": chain_name,
                "name": config["name"],
                "chain_id": config["chain_id"],
                "native_token": config["native_token"],
                "color": config["color"],
                "explorer": config["explorer"],
                "connected": self.providers.get(chain_name) is not None
            })
        return chains
    
    async def get_chain_balance(self, chain: str, address: str) -> Dict[str, Any]:
        """Get native token balance for specific chain"""
        try:
            if chain not in self.providers or not self.providers[chain]:
                return {"error": f"Chain {chain} not supported or not connected"}
            
            provider = self.providers[chain]
            config = CHAIN_CONFIGS[chain]
            
            if not is_address(address):
                return {"error": "Invalid address"}
            
            checksum_address = to_checksum_address(address)
            balance_wei = provider.eth.get_balance(checksum_address)
            balance = provider.from_wei(balance_wei, 'ether')
            
            return {
                "chain": chain,
                "address": checksum_address,
                "balance": float(balance),
                "symbol": config["native_token"]["symbol"],
                "decimals": config["native_token"]["decimals"],
                "balance_wei": str(balance_wei),
                "usd_value": await self._get_token_price(config["native_token"]["symbol"])
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get {chain} balance: {e}")
            return {"error": str(e)}
    
    async def get_all_chain_balances(self, address: str) -> Dict[str, Any]:
        """Get balances across all supported chains"""
        try:
            balances = {}
            total_usd_value = 0
            
            for chain_name in CHAIN_CONFIGS.keys():
                balance_data = await self.get_chain_balance(chain_name, address)
                balances[chain_name] = balance_data
                
                if "usd_value" in balance_data and balance_data["usd_value"]:
                    total_usd_value += balance_data["balance"] * balance_data["usd_value"]
            
            return {
                "address": address,
                "chains": balances,
                "total_usd_value": round(total_usd_value, 2),
                "chain_count": len([b for b in balances.values() if "error" not in b])
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get all chain balances: {e}")
            return {"error": str(e)}
    
    async def get_chain_tokens(self, chain: str, address: str) -> List[Dict[str, Any]]:
        """Get token balances for specific chain"""
        try:
            if chain not in CHAIN_TOKENS:
                return []
            
            provider = self.providers.get(chain)
            if not provider:
                return []
            
            tokens = []
            for symbol, contract_address in CHAIN_TOKENS[chain].items():
                try:
                    # This would use the token contract to get balance
                    # For now, return mock data
                    tokens.append({
                        "symbol": symbol,
                        "address": contract_address,
                        "balance": 0.0,
                        "decimals": 18,
                        "chain": chain
                    })
                except Exception as token_error:
                    self.logger.error(f"Failed to get {symbol} balance on {chain}: {token_error}")
            
            return tokens
            
        except Exception as e:
            self.logger.error(f"Failed to get chain tokens: {e}")
            return []
    
    async def estimate_cross_chain_fee(self, from_chain: str, to_chain: str, amount: float) -> Dict[str, Any]:
        """Estimate fees for cross-chain transfers"""
        try:
            # Mock cross-chain fee estimation
            base_fee = 0.001  # Base fee in ETH equivalent
            
            # Different chains have different fee structures
            chain_multipliers = {
                "ethereum": 3.0,
                "polygon": 0.1,
                "arbitrum": 0.5,
                "optimism": 0.3,
                "bsc": 0.2,
                "avalanche": 0.4
            }
            
            from_multiplier = chain_multipliers.get(from_chain, 1.0)
            to_multiplier = chain_multipliers.get(to_chain, 1.0)
            
            # Calculate estimated fees
            gas_fee = base_fee * from_multiplier
            bridge_fee = base_fee * 0.5
            total_fee = gas_fee + bridge_fee
            
            # Calculate percentage of transfer amount
            if amount > 0:
                fee_percentage = (total_fee / amount) * 100
            else:
                fee_percentage = 0
            
            return {
                "from_chain": from_chain,
                "to_chain": to_chain,
                "amount": amount,
                "gas_fee": round(gas_fee, 6),
                "bridge_fee": round(bridge_fee, 6),
                "total_fee": round(total_fee, 6),
                "fee_percentage": round(fee_percentage, 2),
                "estimated_time": "2-10 minutes",
                "recommended": fee_percentage < 5.0  # Recommend if fees are less than 5%
            }
            
        except Exception as e:
            self.logger.error(f"Failed to estimate cross-chain fees: {e}")
            return {"error": str(e)}
    
    async def get_chain_status(self, chain: str) -> Dict[str, Any]:
        """Get current status and health of blockchain network"""
        try:
            provider = self.providers.get(chain)
            if not provider:
                return {"error": f"Chain {chain} not available"}
            
            config = CHAIN_CONFIGS[chain]
            
            # Get latest block
            latest_block = provider.eth.get_block('latest')
            
            # Get gas price
            gas_price = provider.eth.gas_price
            gas_price_gwei = provider.from_wei(gas_price, 'gwei')
            
            # Calculate network health metrics
            block_time = datetime.fromtimestamp(latest_block.timestamp)
            seconds_since_block = (datetime.now() - block_time).total_seconds()
            
            # Determine network status
            if seconds_since_block < 30:
                status = "healthy"
            elif seconds_since_block < 120:
                status = "slow"
            else:
                status = "congested"
            
            return {
                "chain": chain,
                "name": config["name"],
                "status": status,
                "latest_block": latest_block.number,
                "block_timestamp": latest_block.timestamp,
                "seconds_since_block": int(seconds_since_block),
                "gas_price_gwei": float(gas_price_gwei),
                "gas_price_wei": str(gas_price),
                "chain_id": config["chain_id"],
                "explorer": config["explorer"]
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get {chain} status: {e}")
            return {"error": str(e)}
    
    async def _get_token_price(self, symbol: str) -> Optional[float]:
        """Get current token price in USD"""
        try:
            # Mock price data - in production, use CoinGecko/CoinMarketCap API
            mock_prices = {
                "ETH": 2500.0,
                "MATIC": 0.75,
                "BNB": 300.0,
                "AVAX": 25.0,
                "USDC": 1.0,
                "USDT": 1.0,
                "DAI": 1.0
            }
            
            return mock_prices.get(symbol.upper())
            
        except Exception as e:
            self.logger.error(f"Failed to get price for {symbol}: {e}")
            return None
    
    async def get_recommended_chain(self, transfer_amount: float, recipient_address: str) -> Dict[str, Any]:
        """Recommend the best chain for a transfer based on amount and fees"""
        try:
            recommendations = []
            
            for chain_name in CHAIN_CONFIGS.keys():
                if not self.providers.get(chain_name):
                    continue
                
                # Get chain status
                status = await self.get_chain_status(chain_name)
                if "error" in status:
                    continue
                
                # Estimate fees (mock calculation)
                config = CHAIN_CONFIGS[chain_name]
                gas_price_gwei = status.get("gas_price_gwei", 20)
                
                # Estimate transfer cost in USD
                if chain_name == "polygon":
                    transfer_cost_usd = 0.01
                elif chain_name == "arbitrum":
                    transfer_cost_usd = 0.5
                elif chain_name == "optimism":
                    transfer_cost_usd = 0.3
                elif chain_name == "bsc":
                    transfer_cost_usd = 0.2
                elif chain_name == "avalanche":
                    transfer_cost_usd = 0.4
                else:  # ethereum
                    transfer_cost_usd = gas_price_gwei * 0.001 * 2500  # Rough estimate
                
                # Calculate cost percentage
                if transfer_amount > 0:
                    cost_percentage = (transfer_cost_usd / transfer_amount) * 100
                else:
                    cost_percentage = 100
                
                # Calculate recommendation score
                score = 100
                if status["status"] == "slow":
                    score -= 20
                elif status["status"] == "congested":
                    score -= 40
                
                if cost_percentage > 10:
                    score -= 30
                elif cost_percentage > 5:
                    score -= 15
                
                recommendations.append({
                    "chain": chain_name,
                    "name": config["name"],
                    "score": max(0, score),
                    "transfer_cost_usd": round(transfer_cost_usd, 4),
                    "cost_percentage": round(cost_percentage, 2),
                    "network_status": status["status"],
                    "gas_price_gwei": gas_price_gwei,
                    "estimated_time": "1-2 minutes" if chain_name != "ethereum" else "2-5 minutes",
                    "color": config["color"]
                })
            
            # Sort by score (highest first)
            recommendations.sort(key=lambda x: x["score"], reverse=True)
            
            return {
                "transfer_amount": transfer_amount,
                "recommendations": recommendations,
                "best_choice": recommendations[0] if recommendations else None
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get chain recommendations: {e}")
            return {"error": str(e)}
    
    def get_chain_by_id(self, chain_id: int) -> Optional[str]:
        """Get chain name by chain ID"""
        for chain_name, config in CHAIN_CONFIGS.items():
            if config["chain_id"] == chain_id:
                return chain_name
        return None
    
    def is_chain_supported(self, chain: str) -> bool:
        """Check if chain is supported"""
        return chain in CHAIN_CONFIGS and self.providers.get(chain) is not None

# Initialize multi-chain service
multi_chain_service = MultiChainService()