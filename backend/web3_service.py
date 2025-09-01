import json
import logging
from typing import Dict, List, Optional, Any
from web3 import Web3
from eth_utils import to_checksum_address, is_address
import requests
import asyncio
import aiohttp
from datetime import datetime
import os

# ERC-20 ABI (minimal)
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    }
]

# ERC-721 ABI (minimal)
ERC721_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"name": "", "type": "address"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_from", "type": "address"},
            {"name": "_to", "type": "address"},
            {"name": "_tokenId", "type": "uint256"}
        ],
        "name": "transferFrom",
        "outputs": [],
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_from", "type": "address"},
            {"name": "_to", "type": "address"},
            {"name": "_tokenId", "type": "uint256"}
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "type": "function"
    }
]

# Popular token addresses (Ethereum mainnet)
POPULAR_TOKENS = {
    "USDC": "0xA0b86a33E6417B0F90E0Aa97dF2ED5BE4Ab3c9c6",  # Mock address for demo
    "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "UNI": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
}

class Web3Service:
    def __init__(self):
        self.rpc_url = os.environ.get('WEB3_RPC_URL', 'https://mainnet.infura.io/v3/demo')
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.logger = logging.getLogger(__name__)
        
    def is_connected(self) -> bool:
        """Check if Web3 is connected to blockchain"""
        try:
            return self.w3.is_connected()
        except Exception as e:
            self.logger.error(f"Web3 connection check failed: {e}")
            return False

    def is_valid_address(self, address: str) -> bool:
        """Validate Ethereum address"""
        return is_address(address)

    async def get_eth_balance(self, address: str) -> float:
        """Get ETH balance for address"""
        try:
            if not self.is_valid_address(address):
                raise ValueError("Invalid Ethereum address")
            
            checksum_address = to_checksum_address(address)
            balance_wei = self.w3.eth.get_balance(checksum_address)
            balance_eth = self.w3.from_wei(balance_wei, 'ether')
            return float(balance_eth)
        except Exception as e:
            self.logger.error(f"Failed to get ETH balance: {e}")
            return 0.0

    async def get_token_balance(self, address: str, token_address: str) -> Dict[str, Any]:
        """Get ERC-20 token balance and info"""
        try:
            if not self.is_valid_address(address) or not self.is_valid_address(token_address):
                raise ValueError("Invalid address")

            checksum_address = to_checksum_address(address)
            token_checksum = to_checksum_address(token_address)
            
            # Create contract instance
            contract = self.w3.eth.contract(address=token_checksum, abi=ERC20_ABI)
            
            # Get token info
            try:
                name = contract.functions.name().call()
                symbol = contract.functions.symbol().call()
                decimals = contract.functions.decimals().call()
                balance_raw = contract.functions.balanceOf(checksum_address).call()
                balance = balance_raw / (10 ** decimals)
                
                return {
                    "address": token_checksum,
                    "name": name,
                    "symbol": symbol,
                    "decimals": decimals,
                    "balance": balance,
                    "balance_raw": str(balance_raw)
                }
            except Exception as contract_error:
                self.logger.error(f"Contract call failed for {token_address}: {contract_error}")
                return {
                    "address": token_checksum,
                    "name": "Unknown Token",
                    "symbol": "UNK",
                    "decimals": 18,
                    "balance": 0,
                    "balance_raw": "0",
                    "error": str(contract_error)
                }
                
        except Exception as e:
            self.logger.error(f"Failed to get token balance: {e}")
            return {"error": str(e)}

    async def get_popular_token_balances(self, address: str) -> List[Dict[str, Any]]:
        """Get balances for popular tokens"""
        try:
            balances = []
            
            # Add ETH balance
            eth_balance = await self.get_eth_balance(address)
            balances.append({
                "address": "0x0000000000000000000000000000000000000000",
                "name": "Ethereum",
                "symbol": "ETH",
                "decimals": 18,
                "balance": eth_balance,
                "balance_raw": str(int(eth_balance * 10**18)),
                "is_native": True
            })
            
            # Add popular token balances
            for symbol, token_address in POPULAR_TOKENS.items():
                token_info = await self.get_token_balance(address, token_address)
                if "error" not in token_info:
                    balances.append(token_info)
                    
            return balances
            
        except Exception as e:
            self.logger.error(f"Failed to get popular token balances: {e}")
            return []

    async def get_nft_balance(self, address: str, contract_address: str) -> Dict[str, Any]:
        """Get NFT balance and info for ERC-721 contract"""
        try:
            if not self.is_valid_address(address) or not self.is_valid_address(contract_address):
                raise ValueError("Invalid address")

            checksum_address = to_checksum_address(address)
            contract_checksum = to_checksum_address(contract_address)
            
            # Create contract instance
            contract = self.w3.eth.contract(address=contract_checksum, abi=ERC721_ABI)
            
            try:
                # Get contract info
                name = contract.functions.name().call()
                symbol = contract.functions.symbol().call()
                balance = contract.functions.balanceOf(checksum_address).call()
                
                return {
                    "contract_address": contract_checksum,
                    "name": name,
                    "symbol": symbol,
                    "balance": balance,
                    "type": "ERC-721"
                }
                
            except Exception as contract_error:
                self.logger.error(f"NFT contract call failed for {contract_address}: {contract_error}")
                return {
                    "contract_address": contract_checksum,
                    "name": "Unknown NFT",
                    "symbol": "NFT",
                    "balance": 0,
                    "type": "ERC-721",
                    "error": str(contract_error)
                }
                
        except Exception as e:
            self.logger.error(f"Failed to get NFT balance: {e}")
            return {"error": str(e)}

    async def get_nft_metadata(self, contract_address: str, token_id: int) -> Dict[str, Any]:
        """Get NFT metadata from token URI"""
        try:
            if not self.is_valid_address(contract_address):
                raise ValueError("Invalid contract address")

            contract_checksum = to_checksum_address(contract_address)
            contract = self.w3.eth.contract(address=contract_checksum, abi=ERC721_ABI)
            
            try:
                # Get token URI
                token_uri = contract.functions.tokenURI(token_id).call()
                
                # Fetch metadata from URI
                if token_uri.startswith('http'):
                    async with aiohttp.ClientSession() as session:
                        async with session.get(token_uri) as response:
                            if response.status == 200:
                                metadata = await response.json()
                                return {
                                    "token_id": token_id,
                                    "token_uri": token_uri,
                                    "metadata": metadata,
                                    "name": metadata.get("name", f"Token #{token_id}"),
                                    "description": metadata.get("description", ""),
                                    "image": metadata.get("image", ""),
                                    "attributes": metadata.get("attributes", [])
                                }
                            else:
                                return {
                                    "token_id": token_id,
                                    "token_uri": token_uri,
                                    "error": f"Failed to fetch metadata: HTTP {response.status}"
                                }
                else:
                    return {
                        "token_id": token_id,
                        "token_uri": token_uri,
                        "error": "Unsupported URI scheme"
                    }
                    
            except Exception as contract_error:
                return {
                    "token_id": token_id,
                    "error": f"Contract call failed: {contract_error}"
                }
                
        except Exception as e:
            self.logger.error(f"Failed to get NFT metadata: {e}")
            return {"error": str(e)}

    async def validate_transfer_params(self, from_address: str, to_address: str, 
                                     token_address: Optional[str] = None) -> Dict[str, Any]:
        """Validate transfer parameters"""
        try:
            # Validate addresses
            if not self.is_valid_address(from_address):
                return {"valid": False, "error": "Invalid from address"}
            
            if not self.is_valid_address(to_address):
                return {"valid": False, "error": "Invalid to address"}
            
            if token_address and not self.is_valid_address(token_address):
                return {"valid": False, "error": "Invalid token address"}
            
            # Convert to checksum addresses
            from_checksum = to_checksum_address(from_address)
            to_checksum = to_checksum_address(to_address)
            
            result = {
                "valid": True,
                "from_address": from_checksum,
                "to_address": to_checksum
            }
            
            if token_address:
                result["token_address"] = to_checksum_address(token_address)
            
            return result
            
        except Exception as e:
            return {"valid": False, "error": str(e)}

    async def estimate_gas_price(self) -> Dict[str, Any]:
        """Get current gas price estimates"""
        try:
            gas_price = self.w3.eth.gas_price
            gas_price_gwei = self.w3.from_wei(gas_price, 'gwei')
            
            return {
                "gas_price_wei": str(gas_price),
                "gas_price_gwei": float(gas_price_gwei),
                "estimated_cost_eth": {
                    "token_transfer": float(gas_price_gwei * 21000 / 10**9),
                    "nft_transfer": float(gas_price_gwei * 85000 / 10**9)
                }
            }
            
        except Exception as e:
            self.logger.error(f"Failed to estimate gas price: {e}")
            return {"error": str(e)}

    def build_token_transfer_data(self, to_address: str, amount: str) -> str:
        """Build token transfer transaction data"""
        try:
            # Convert to checksum address
            to_checksum = to_checksum_address(to_address)
            
            # Create contract instance (using USDC as example)
            contract = self.w3.eth.contract(abi=ERC20_ABI)
            
            # Build transaction data
            transfer_data = contract.encodeABI(
                fn_name='transfer',
                args=[to_checksum, int(amount)]
            )
            
            return transfer_data
            
        except Exception as e:
            self.logger.error(f"Failed to build token transfer data: {e}")
            raise e

    def build_nft_transfer_data(self, from_address: str, to_address: str, token_id: int) -> str:
        """Build NFT transfer transaction data"""
        try:
            # Convert to checksum addresses
            from_checksum = to_checksum_address(from_address)
            to_checksum = to_checksum_address(to_address)
            
            # Create contract instance
            contract = self.w3.eth.contract(abi=ERC721_ABI)
            
            # Build transaction data for safeTransferFrom
            transfer_data = contract.encodeABI(
                fn_name='safeTransferFrom',
                args=[from_checksum, to_checksum, token_id]
            )
            
            return transfer_data
            
        except Exception as e:
            self.logger.error(f"Failed to build NFT transfer data: {e}")
            raise e

    async def get_transaction_status(self, tx_hash: str) -> Dict[str, Any]:
        """Get transaction status and receipt"""
        try:
            if not tx_hash.startswith('0x') or len(tx_hash) != 66:
                return {"error": "Invalid transaction hash"}
            
            # Get transaction receipt
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            
            if receipt:
                return {
                    "hash": tx_hash,
                    "status": "success" if receipt.status == 1 else "failed",
                    "block_number": receipt.blockNumber,
                    "gas_used": receipt.gasUsed,
                    "logs": len(receipt.logs),
                    "confirmed": True
                }
            else:
                # Check if transaction exists but not mined yet
                try:
                    tx = self.w3.eth.get_transaction(tx_hash)
                    return {
                        "hash": tx_hash,
                        "status": "pending",
                        "confirmed": False
                    }
                except:
                    return {
                        "hash": tx_hash,
                        "status": "not_found",
                        "error": "Transaction not found"
                    }
                    
        except Exception as e:
            self.logger.error(f"Failed to get transaction status: {e}")
            return {"error": str(e)}

# Initialize Web3 service
web3_service = Web3Service()