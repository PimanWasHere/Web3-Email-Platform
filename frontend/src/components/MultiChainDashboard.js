import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import { 
  Globe, TrendingUp, TrendingDown, Zap, Clock, 
  ArrowRightLeft, Shield, AlertTriangle, CheckCircle,
  Coins, Activity, BarChart3, RefreshCw, Star,
  Network, Layers, DollarSign, Timer
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MultiChainDashboard = ({ userProfile, walletAddress }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Multi-chain data
  const [supportedChains, setSupportedChains] = useState([]);
  const [allBalances, setAllBalances] = useState({});
  const [chainStatuses, setChainStatuses] = useState({});
  
  // Cross-chain transfer
  const [transferData, setTransferData] = useState({
    from_chain: 'ethereum',
    to_chain: 'polygon',
    amount: '1.0'
  });
  const [crossChainEstimate, setCrossChainEstimate] = useState(null);
  const [chainRecommendation, setChainRecommendation] = useState(null);
  
  // Selected chain details
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [chainTokens, setChainTokens] = useState([]);

  useEffect(() => {
    if (walletAddress) {
      initializeMultiChainData();
    }
  }, [walletAddress]);

  const initializeMultiChainData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSupportedChains(),
        fetchAllBalances(),
        fetchChainStatuses()
      ]);
    } catch (error) {
      console.error('Failed to initialize multi-chain data:', error);
      toast.error('Failed to load multi-chain data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportedChains = async () => {
    try {
      const response = await axios.get(`${API}/multichain/supported-chains`);
      setSupportedChains(response.data.chains || []);
    } catch (error) {
      console.error('Failed to fetch supported chains:', error);
    }
  };

  const fetchAllBalances = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/multichain/all-balances/${walletAddress}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllBalances(response.data);
    } catch (error) {
      console.error('Failed to fetch all balances:', error);
    }
  };

  const fetchChainStatuses = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const statuses = {};
      
      for (const chain of supportedChains) {
        try {
          const response = await axios.get(`${API}/multichain/chain-status/${chain.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          statuses[chain.id] = response.data;
        } catch (error) {
          console.error(`Failed to fetch ${chain.id} status:`, error);
          statuses[chain.id] = { error: 'Failed to load' };
        }
      }
      
      setChainStatuses(statuses);
    } catch (error) {
      console.error('Failed to fetch chain statuses:', error);
    }
  };

  const fetchChainTokens = async (chain) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/multichain/tokens/${chain}/${walletAddress}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChainTokens(response.data.tokens || []);
    } catch (error) {
      console.error('Failed to fetch chain tokens:', error);
      setChainTokens([]);
    }
  };

  const estimateCrossChainFee = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(`${API}/multichain/estimate-cross-chain-fee`, {
        from_chain: transferData.from_chain,
        to_chain: transferData.to_chain,
        amount: parseFloat(transferData.amount)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCrossChainEstimate(response.data);
    } catch (error) {
      console.error('Failed to estimate cross-chain fee:', error);
      toast.error('Failed to estimate transfer fees');
    }
  };

  const getChainRecommendation = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(`${API}/multichain/recommend-chain`, {
        transfer_amount: parseFloat(transferData.amount),
        recipient_address: walletAddress
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setChainRecommendation(response.data);
    } catch (error) {
      console.error('Failed to get chain recommendation:', error);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await initializeMultiChainData();
    setRefreshing(false);
    toast.success('Multi-chain data refreshed!');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'slow': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'congested': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'slow': return <Clock className="w-4 h-4" />;
      case 'congested': return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount, symbol = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: symbol === 'USD' ? 'USD' : undefined,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount);
  };

  if (loading && supportedChains.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600">Loading multi-chain data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Multi-Chain Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-6 h-6 text-blue-600" />
                Multi-Chain Dashboard
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  <Layers className="w-3 h-3 mr-1" />
                  {supportedChains.length} Chains
                </Badge>
              </CardTitle>
              <CardDescription>
                Manage assets across multiple blockchain networks
              </CardDescription>
            </div>
            <Button 
              onClick={refreshData} 
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Multi-Chain Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="balances" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Balances
          </TabsTrigger>
          <TabsTrigger value="cross-chain" className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Cross-Chain
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Network Status
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Portfolio Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Portfolio Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(allBalances.total_usd_value || 0)}
                  </div>
                  <p className="text-sm text-gray-600">Total Portfolio Value</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {allBalances.chain_count || 0}
                  </div>
                  <p className="text-sm text-gray-600">Active Chains</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {Object.keys(allBalances.chains || {}).length}
                  </div>
                  <p className="text-sm text-gray-600">Network Connections</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chain Quick Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {supportedChains.map((chain) => {
              const balance = allBalances.chains?.[chain.id];
              const status = chainStatuses[chain.id];
              
              return (
                <Card key={chain.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: chain.color }}
                        />
                        <span className="font-medium">{chain.name}</span>
                      </div>
                      {status && (
                        <Badge className={`text-xs ${getStatusColor(status.status)} border`}>
                          {getStatusIcon(status.status)}
                          <span className="ml-1">{status.status}</span>
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Balance:</span>
                        <span className="font-medium">
                          {balance && !balance.error ? 
                            `${balance.balance?.toFixed(4)} ${balance.symbol}` : 
                            'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>USD Value:</span>
                        <span className="font-medium text-green-600">
                          {balance && balance.usd_value ? 
                            formatCurrency(balance.balance * balance.usd_value) : 
                            '$0.00'
                          }
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5" />
                  Chain Balances
                </CardTitle>
                <Select value={selectedChain} onValueChange={(value) => {
                  setSelectedChain(value);
                  fetchChainTokens(value);
                }}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedChains.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: chain.color }}
                          />
                          {chain.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {/* Native Token Balance */}
              {allBalances.chains?.[selectedChain] && (
                <Card className="mb-4 bg-gradient-to-r from-blue-50 to-purple-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Native Token</h3>
                        <p className="text-sm text-gray-600">
                          {allBalances.chains[selectedChain].symbol}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {allBalances.chains[selectedChain].balance?.toFixed(6)}
                        </div>
                        <div className="text-sm text-green-600">
                          {allBalances.chains[selectedChain].usd_value ? 
                            formatCurrency(allBalances.chains[selectedChain].balance * allBalances.chains[selectedChain].usd_value) : 
                            '$0.00'
                          }
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Token Balances */}
              {chainTokens.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">ERC-20 Tokens</h4>
                  {chainTokens.map((token, index) => (
                    <Card key={index} className="bg-gray-50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{token.symbol}</span>
                            <p className="text-xs text-gray-600">{token.address.slice(0, 6)}...{token.address.slice(-4)}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{token.balance.toFixed(4)}</div>
                            <div className="text-xs text-gray-600">{token.symbol}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <Coins className="h-4 w-4" />
                  <AlertDescription>
                    No ERC-20 tokens found on {selectedChain}. Tokens will appear here once detected.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cross-Chain Tab */}
        <TabsContent value="cross-chain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Cross-Chain Transfer Optimizer
              </CardTitle>
              <CardDescription>
                Find the best routes and estimate fees for cross-chain transfers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>From Chain</Label>
                  <Select 
                    value={transferData.from_chain} 
                    onValueChange={(value) => setTransferData(prev => ({ ...prev, from_chain: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedChains.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>To Chain</Label>
                  <Select 
                    value={transferData.to_chain} 
                    onValueChange={(value) => setTransferData(prev => ({ ...prev, to_chain: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedChains.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={transferData.amount}
                    onChange={(e) => setTransferData(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={estimateCrossChainFee} variant="outline">
                  <Zap className="w-4 h-4 mr-2" />
                  Estimate Fees
                </Button>
                <Button onClick={getChainRecommendation} variant="outline">
                  <Star className="w-4 h-4 mr-2" />
                  Get Recommendation
                </Button>
              </div>

              {/* Cross-Chain Estimate */}
              {crossChainEstimate && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-700 text-sm">Cross-Chain Fee Estimate</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Gas Fee:</span>
                        <span className="ml-2 font-medium">{crossChainEstimate.gas_fee} ETH</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Bridge Fee:</span>
                        <span className="ml-2 font-medium">{crossChainEstimate.bridge_fee} ETH</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Fee:</span>
                        <span className="ml-2 font-medium text-blue-600">{crossChainEstimate.total_fee} ETH</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Fee %:</span>
                        <span className="ml-2 font-medium">{crossChainEstimate.fee_percentage}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="w-4 h-4" />
                      <span>Estimated Time: {crossChainEstimate.estimated_time}</span>
                    </div>
                    {crossChainEstimate.recommended && (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Recommended Route
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Chain Recommendation */}
              {chainRecommendation && chainRecommendation.recommendations && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      AI Chain Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {chainRecommendation.recommendations.slice(0, 3).map((rec, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-bold text-gray-700">#{index + 1}</div>
                            <div>
                              <div className="font-medium">{rec.name}</div>
                              <div className="text-sm text-gray-600">
                                {rec.transfer_cost_usd} USD ({rec.cost_percentage}%)
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: rec.color }}
                              />
                              <Progress value={rec.score} className="w-20 h-2" />
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              Score: {rec.score}/100
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Network Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supportedChains.map((chain) => {
              const status = chainStatuses[chain.id];
              
              return (
                <Card key={chain.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: chain.color }}
                      />
                      {chain.name}
                      {status && (
                        <Badge className={`${getStatusColor(status.status)} border`}>
                          {getStatusIcon(status.status)}
                          <span className="ml-1">{status.status}</span>
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {status && !status.error ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Latest Block:</span>
                            <div className="font-medium">{status.latest_block?.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Gas Price:</span>
                            <div className="font-medium">{status.gas_price_gwei?.toFixed(2)} gwei</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Last Block:</span>
                            <div className="font-medium">{status.seconds_since_block}s ago</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Chain ID:</span>
                            <div className="font-medium">{status.chain_id}</div>
                          </div>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => window.open(status.explorer, '_blank')}
                          className="w-full"
                        >
                          View Explorer
                        </Button>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Failed to load network status
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MultiChainDashboard;