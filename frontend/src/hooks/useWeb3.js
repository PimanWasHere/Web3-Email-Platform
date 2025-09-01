import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import { toast } from 'sonner';

// ERC-20 ABI (minimal)
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// ERC-721 ABI (minimal)
const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

const useWeb3 = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize provider
  const initializeProvider = useCallback(async () => {
    try {
      const ethereumProvider = await detectEthereumProvider({ silent: true });
      
      if (ethereumProvider && ethereumProvider.isMetaMask) {
        const web3Provider = new ethers.BrowserProvider(ethereumProvider);
        setProvider(web3Provider);
        
        // Check if already connected
        const accounts = await ethereumProvider.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const signer = await web3Provider.getSigner();
          setSigner(signer);
          setIsConnected(true);
          
          // Get chain ID
          const network = await web3Provider.getNetwork();
          setChainId(Number(network.chainId));
        }
        
        // Set up event listeners
        ethereumProvider.on('accountsChanged', handleAccountsChanged);
        ethereumProvider.on('chainChanged', handleChainChanged);
        
        return true;
      } else {
        throw new Error('MetaMask not detected. Please install MetaMask.');
      }
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  // Handle account changes
  const handleAccountsChanged = useCallback((accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
      toast.info('Account switched');
    }
  }, []);

  // Handle chain changes
  const handleChainChanged = useCallback((chainId) => {
    const numericChainId = parseInt(chainId, 16);
    setChainId(numericChainId);
    window.location.reload(); // Recommended by MetaMask
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const ethereumProvider = await detectEthereumProvider();
      if (!ethereumProvider) {
        throw new Error('MetaMask not found. Please install MetaMask.');
      }

      // Request account access
      const accounts = await ethereumProvider.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const web3Provider = new ethers.BrowserProvider(ethereumProvider);
      const signer = await web3Provider.getSigner();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setIsConnected(true);

      toast.success('MetaMask connected successfully!');
      return accounts[0];

    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount('');
    setChainId(null);
    setIsConnected(false);
    setError('');
    toast.info('Wallet disconnected');
  }, []);

  // Get ETH balance
  const getBalance = useCallback(async (address = account) => {
    try {
      if (!provider || !address) return '0';
      
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (err) {
      console.error('Error getting balance:', err);
      return '0';
    }
  }, [provider, account]);

  // Get token balance
  const getTokenBalance = useCallback(async (tokenAddress, userAddress = account) => {
    try {
      if (!provider || !userAddress) return '0';

      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await contract.balanceOf(userAddress);
      const decimals = await contract.decimals();
      
      return ethers.formatUnits(balance, decimals);
    } catch (err) {
      console.error('Error getting token balance:', err);
      return '0';
    }
  }, [provider, account]);

  // Get token info
  const getTokenInfo = useCallback(async (tokenAddress) => {
    try {
      if (!provider) return null;

      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals()
      ]);

      return { name, symbol, decimals: Number(decimals) };
    } catch (err) {
      console.error('Error getting token info:', err);
      return null;
    }
  }, [provider]);

  // Get NFT info
  const getNFTInfo = useCallback(async (contractAddress, tokenId = null) => {
    try {
      if (!provider) return null;

      const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
      const [name, symbol] = await Promise.all([
        contract.name(),
        contract.symbol()
      ]);

      let tokenURI = null;
      if (tokenId !== null) {
        try {
          tokenURI = await contract.tokenURI(tokenId);
        } catch (err) {
          console.warn('Could not get tokenURI:', err);
        }
      }

      return { name, symbol, tokenURI };
    } catch (err) {
      console.error('Error getting NFT info:', err);
      return null;
    }
  }, [provider]);

  // Send ETH
  const sendETH = useCallback(async (to, amount) => {
    try {
      if (!signer) throw new Error('Signer not available');

      const tx = await signer.sendTransaction({
        to: to,
        value: ethers.parseEther(amount.toString()),
      });

      toast.info('Transaction sent! Waiting for confirmation...');
      await tx.wait();
      toast.success('ETH transfer confirmed!');
      
      return tx.hash;
    } catch (err) {
      console.error('Error sending ETH:', err);
      toast.error(`ETH transfer failed: ${err.message}`);
      throw err;
    }
  }, [signer]);

  // Send ERC-20 Token
  const sendToken = useCallback(async (tokenAddress, to, amount, decimals = 18) => {
    try {
      if (!signer) throw new Error('Signer not available');

      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
      
      const tx = await contract.transfer(to, tokenAmount);
      
      toast.info('Token transfer sent! Waiting for confirmation...');
      await tx.wait();
      toast.success('Token transfer confirmed!');
      
      return tx.hash;
    } catch (err) {
      console.error('Error sending token:', err);
      toast.error(`Token transfer failed: ${err.message}`);
      throw err;
    }
  }, [signer]);

  // Send NFT
  const sendNFT = useCallback(async (contractAddress, to, tokenId) => {
    try {
      if (!signer || !account) throw new Error('Signer or account not available');

      const contract = new ethers.Contract(contractAddress, ERC721_ABI, signer);
      
      // Use safeTransferFrom
      const tx = await contract.safeTransferFrom(account, to, tokenId);
      
      toast.info('NFT transfer sent! Waiting for confirmation...');
      await tx.wait();
      toast.success('NFT transfer confirmed!');
      
      return tx.hash;
    } catch (err) {
      console.error('Error sending NFT:', err);
      toast.error(`NFT transfer failed: ${err.message}`);
      throw err;
    }
  }, [signer, account]);

  // Estimate gas for transaction
  const estimateGas = useCallback(async (transaction) => {
    try {
      if (!provider) throw new Error('Provider not available');
      
      const gasEstimate = await provider.estimateGas(transaction);
      const gasPrice = await provider.getFeeData();
      
      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: gasPrice.gasPrice?.toString() || '0',
        maxFeePerGas: gasPrice.maxFeePerGas?.toString() || '0',
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString() || '0'
      };
    } catch (err) {
      console.error('Error estimating gas:', err);
      throw err;
    }
  }, [provider]);

  // Switch network
  const switchNetwork = useCallback(async (targetChainId) => {
    try {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error('MetaMask not found');

      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (err) {
      if (err.code === 4902) {
        toast.error('Network not added to MetaMask');
      } else {
        toast.error(`Failed to switch network: ${err.message}`);
      }
      throw err;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeProvider();
    
    // Cleanup listeners on unmount
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [initializeProvider, handleAccountsChanged, handleChainChanged]);

  return {
    // State
    provider,
    signer,
    account,
    chainId,
    isConnected,
    loading,
    error,
    
    // Actions
    connectWallet,
    disconnectWallet,
    
    // Utilities
    getBalance,
    getTokenBalance,
    getTokenInfo,
    getNFTInfo,
    
    // Transactions
    sendETH,
    sendToken,
    sendNFT,
    estimateGas,
    
    // Network
    switchNetwork
  };
};

export default useWeb3;