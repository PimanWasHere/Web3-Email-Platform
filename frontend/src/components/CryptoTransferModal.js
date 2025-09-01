import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { 
  Coins, Send, AlertCircle, CheckCircle, Wallet, 
  Image as ImageIcon, DollarSign, Zap, Clock,
  RefreshCw, ExternalLink, Copy
} from 'lucide-react';
import useWeb3 from '../hooks/useWeb3';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CryptoTransferModal = ({ 
  isOpen, 
  onClose, 
  onTransferComplete, 
  recipientEmail = '',
  includeInEmail = false 
}) => {
  const web3 = useWeb3();
  const [transferType, setTransferType] = useState('token');
  const [tokenBalances, setTokenBalances] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [transferDetails, setTransferDetails] = useState({
    to: '',
    amount: '',
    tokenAddress: '',
    tokenId: '',
    contractAddress: ''
  });
  const [gasEstimate, setGasEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [customTokenInfo, setCustomTokenInfo] = useState(null);
  const [transactionHash, setTransactionHash] = useState('');
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Fetch wallet balances when modal opens and wallet is connected
  useEffect(() => {
    if (isOpen && web3.isConnected && web3.account) {
      fetchTokenBalances();
    }
  }, [isOpen, web3.isConnected, web3.account]);

  // Set recipient from email if provided
  useEffect(() => {
    if (recipientEmail && isOpen) {
      // For demo, we'll use a placeholder address. In real app, you'd have address resolution
      setTransferDetails(prev => ({
        ...prev,
        to: '0x742d35Cc6634C0532925a3b8D404fddF6fE7d396' // Placeholder
      }));
    }
  }, [recipientEmail, isOpen]);

  const fetchTokenBalances = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await axios.get(`${API}/web3/balances/${web3.account}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTokenBalances(response.data.balances || []);
      
      // Set first token as default
      if (response.data.balances && response.data.balances.length > 0) {
        setSelectedToken(response.data.balances[0]);
      }
      
    } catch (error) {
      console.error('Failed to fetch token balances:', error);
      toast.error('Failed to load token balances');
      
      // Fallback to Web3 direct calls
      try {
        const ethBalance = await web3.getBalance();
        setTokenBalances([{
          address: '0x0000000000000000000000000000000000000000',
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
          balance: parseFloat(ethBalance),
          is_native: true
        }]);
      } catch (fallbackError) {
        console.error('Fallback balance fetch failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomToken = async () => {
    if (!customTokenAddress || !web3.provider) return;
    
    try {
      setLoading(true);
      const tokenInfo = await web3.getTokenInfo(customTokenAddress);
      
      if (tokenInfo) {
        const balance = await web3.getTokenBalance(customTokenAddress);
        const customToken = {
          address: customTokenAddress,
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          decimals: tokenInfo.decimals,
          balance: parseFloat(balance),
          is_custom: true
        };
        
        setTokenBalances(prev => [...prev, customToken]);
        setCustomTokenInfo(customToken);
        setCustomTokenAddress('');
        toast.success(`Added ${tokenInfo.symbol} token`);
      }
    } catch (error) {
      toast.error('Failed to add custom token');
    } finally {
      setLoading(false);
    }
  };

  const validateTransfer = async () => {
    try {
      setValidationError('');
      
      if (!transferDetails.to) {
        setValidationError('Recipient address is required');
        return false;
      }
      
      if (transferType === 'token' && (!transferDetails.amount || parseFloat(transferDetails.amount) <= 0)) {
        setValidationError('Valid amount is required');
        return false;
      }
      
      if (transferType === 'nft' && !transferDetails.tokenId) {
        setValidationError('Token ID is required for NFT transfer');
        return false;
      }
      
      // Validate with backend
      const token = localStorage.getItem('authToken');
      await axios.post(`${API}/web3/validate-transfer`, {
        from_address: web3.account,
        to_address: transferDetails.to,
        token_address: selectedToken?.address !== '0x0000000000000000000000000000000000000000' ? selectedToken?.address : null,
        amount: transferDetails.amount,
        token_type: transferType === 'nft' ? 'ERC721' : 'ERC20'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Validation failed';
      setValidationError(errorMessage);
      return false;
    }
  };

  const executeTransfer = async () => {
    try {
      setTransferring(true);
      setValidationError('');
      
      // Validate first
      const isValid = await validateTransfer();
      if (!isValid) return;
      
      let txHash;
      
      if (transferType === 'token') {
        if (selectedToken?.is_native) {
          // ETH transfer
          txHash = await web3.sendETH(transferDetails.to, transferDetails.amount);
        } else {
          // ERC-20 token transfer
          txHash = await web3.sendToken(
            selectedToken.address,
            transferDetails.to,
            transferDetails.amount,
            selectedToken.decimals
          );
        }
      } else if (transferType === 'nft') {
        // NFT transfer
        txHash = await web3.sendNFT(
          transferDetails.contractAddress,
          transferDetails.to,
          transferDetails.tokenId
        );
      }
      
      setTransactionHash(txHash);
      setTransferSuccess(true);
      
      // Record transaction in backend
      try {
        const token = localStorage.getItem('authToken');
        await axios.post(`${API}/web3/transaction/record?transaction_hash=${txHash}`, {
          from_address: web3.account,
          to_address: transferDetails.to,
          token_address: selectedToken?.address !== '0x0000000000000000000000000000000000000000' ? selectedToken?.address : null,
          amount: transferDetails.amount,
          token_type: transferType === 'nft' ? 'ERC721' : 'ERC20'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (recordError) {
        console.error('Failed to record transaction:', recordError);
      }
      
      // Call completion callback
      if (onTransferComplete) {
        onTransferComplete({
          hash: txHash,
          type: transferType,
          token: selectedToken,
          amount: transferDetails.amount,
          to: transferDetails.to
        });
      }
      
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error(`Transfer failed: ${error.message}`);
    } finally {
      setTransferring(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const resetModal = () => {
    setTransferType('token');
    setTransferDetails({
      to: '',
      amount: '',
      tokenAddress: '',
      tokenId: '',
      contractAddress: ''
    });
    setValidationError('');
    setTransactionHash('');
    setTransferSuccess(false);
    setGasEstimate(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!web3.isConnected) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </DialogTitle>
            <DialogDescription>
              Connect your MetaMask wallet to send crypto assets via email
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <Button onClick={web3.connectWallet} disabled={web3.loading}>
              {web3.loading ? 'Connecting...' : 'Connect MetaMask'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (transferSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Transfer Successful!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Your {transferType === 'nft' ? 'NFT' : 'token'} transfer has been sent successfully!
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white px-2 py-1 rounded flex-1">
                    {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(transactionHash)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(`https://etherscan.io/tx/${transactionHash}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Crypto Assets
          </DialogTitle>
          <DialogDescription>
            Send tokens or NFTs directly through email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Wallet Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Connected Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  <code className="text-sm">{web3.account?.slice(0, 6)}...{web3.account?.slice(-4)}</code>
                </div>
                <Badge variant="secondary">MetaMask</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Transfer Type Selection */}
          <Tabs value={transferType} onValueChange={setTransferType}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="token" className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                Tokens
              </TabsTrigger>
              <TabsTrigger value="nft" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                NFTs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="token" className="space-y-4">
              {/* Token Selection */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  Loading balances...
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Select Token</Label>
                    <div className="grid gap-2 mt-2">
                      {tokenBalances.map((token, index) => (
                        <Card
                          key={index}
                          className={`cursor-pointer transition-all ${
                            selectedToken?.address === token.address
                              ? 'ring-2 ring-indigo-500 bg-indigo-50'
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => setSelectedToken(token)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{token.symbol}</div>
                                <div className="text-sm text-gray-500">{token.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{token.balance.toFixed(4)}</div>
                                <div className="text-sm text-gray-500">{token.symbol}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Custom Token */}
                  <div className="space-y-2">
                    <Label>Add Custom Token</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Token contract address"
                        value={customTokenAddress}
                        onChange={(e) => setCustomTokenAddress(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        onClick={handleAddCustomToken}
                        disabled={!customTokenAddress || loading}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer Details */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="recipient">Recipient Address</Label>
                  <Input
                    id="recipient"
                    placeholder="0x..."
                    value={transferDetails.to}
                    onChange={(e) => setTransferDetails(prev => ({ ...prev, to: e.target.value }))}
                  />
                  {recipientEmail && (
                    <p className="text-xs text-gray-500 mt-1">
                      Sending to: {recipientEmail}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.0"
                      value={transferDetails.amount}
                      onChange={(e) => setTransferDetails(prev => ({ ...prev, amount: e.target.value }))}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {selectedToken?.symbol || 'TOKEN'}
                    </div>
                  </div>
                  {selectedToken && (
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {selectedToken.balance.toFixed(4)} {selectedToken.symbol}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="nft" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nft-contract">NFT Contract Address</Label>
                  <Input
                    id="nft-contract"
                    placeholder="0x..."
                    value={transferDetails.contractAddress}
                    onChange={(e) => setTransferDetails(prev => ({ ...prev, contractAddress: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="token-id">Token ID</Label>
                  <Input
                    id="token-id"
                    type="number"
                    placeholder="1"
                    value={transferDetails.tokenId}
                    onChange={(e) => setTransferDetails(prev => ({ ...prev, tokenId: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="nft-recipient">Recipient Address</Label>
                  <Input
                    id="nft-recipient"
                    placeholder="0x..."
                    value={transferDetails.to}
                    onChange={(e) => setTransferDetails(prev => ({ ...prev, to: e.target.value }))}
                  />
                  {recipientEmail && (
                    <p className="text-xs text-gray-500 mt-1">
                      Sending to: {recipientEmail}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Gas Estimate */}
          {gasEstimate && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Gas Estimate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Gas Limit:</span>
                    <span className="ml-2">{gasEstimate.gasLimit}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Gas Price:</span>
                    <span className="ml-2">{gasEstimate.gasPrice} gwei</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={executeTransfer}
            disabled={transferring || loading || !selectedToken}
            className="flex items-center gap-2"
          >
            {transferring ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send {transferType === 'nft' ? 'NFT' : 'Tokens'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CryptoTransferModal;