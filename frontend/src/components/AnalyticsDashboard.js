import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Activity,
  Users, Mail, Coins, Shield, AlertTriangle, CheckCircle,
  PieChart, LineChart, Target, Zap, Crown, RefreshCw,
  Calendar, Clock, Star, Award, ThumbsUp, Eye
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AnalyticsDashboard = ({ userProfile }) => {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(false);
  
  // Analytics data
  const [portfolioAnalytics, setPortfolioAnalytics] = useState(null);
  const [platformAnalytics, setPlatformAnalytics] = useState(null);
  const [cryptoMarketAnalytics, setCryptoMarketAnalytics] = useState(null);
  const [riskAssessment, setRiskAssessment] = useState(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeframe]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchPortfolioAnalytics(),
        fetchCryptoMarketAnalytics(),
        fetchRiskAssessment()
      ]);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolioAnalytics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/analytics/user-portfolio?timeframe=${timeframe}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPortfolioAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch portfolio analytics:', error);
    }
  };

  const fetchPlatformAnalytics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/analytics/platform?timeframe=${timeframe}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlatformAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch platform analytics:', error);
    }
  };

  const fetchCryptoMarketAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/analytics/crypto-market`);
      setCryptoMarketAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch crypto market analytics:', error);
    }
  };

  const fetchRiskAssessment = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/analytics/risk-assessment`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRiskAssessment(response.data);
    } catch (error) {
      console.error('Failed to fetch risk assessment:', error);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getTrendIcon = (value) => {
    return value >= 0 ? 
      <TrendingUp className="w-4 h-4 text-green-500" /> : 
      <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getTrendColor = (value) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'very_high': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const refreshAnalytics = async () => {
    await fetchAnalyticsData();
    toast.success('Analytics data refreshed!');
  };

  if (loading && !portfolioAnalytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Header */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                Advanced Analytics Dashboard
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                  <Star className="w-3 h-3 mr-1" />
                  AI-Powered
                </Badge>
              </CardTitle>
              <CardDescription>
                Comprehensive insights into your Web3 email and crypto activities
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                  <SelectItem value="90d">90 Days</SelectItem>
                  <SelectItem value="1y">1 Year</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={refreshAnalytics} 
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="portfolio" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Portfolio
          </TabsTrigger>
          <TabsTrigger value="market" className="flex items-center gap-2">
            <LineChart className="w-4 h-4" />
            Market
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Risk
          </TabsTrigger>
          <TabsTrigger value="platform" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Platform
          </TabsTrigger>
        </TabsList>

        {/* Portfolio Analytics Tab */}
        <TabsContent value="portfolio" className="space-y-4">
          {portfolioAnalytics && (
            <>
              {/* Portfolio Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Portfolio Value</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(portfolioAnalytics.portfolio_analytics?.current_value_usd || 0)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-500 opacity-75" />
                    </div>
                    <div className="flex items-center mt-2 text-sm">
                      {getTrendIcon(portfolioAnalytics.portfolio_analytics?.change_percentage_24h || 0)}
                      <span className={`ml-1 ${getTrendColor(portfolioAnalytics.portfolio_analytics?.change_percentage_24h || 0)}`}>
                        {formatPercentage(portfolioAnalytics.portfolio_analytics?.change_percentage_24h || 0)} (24h)
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Transactions</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {portfolioAnalytics.transaction_analytics?.total_transactions || 0}
                        </p>
                      </div>
                      <Activity className="w-8 h-8 text-blue-500 opacity-75" />
                    </div>
                    <div className="flex items-center mt-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="ml-1 text-green-600">
                        {portfolioAnalytics.transaction_analytics?.success_rate || 0}% success rate
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Email Activity</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {portfolioAnalytics.email_analytics?.total_emails || 0}
                        </p>
                      </div>
                      <Mail className="w-8 h-8 text-purple-500 opacity-75" />
                    </div>
                    <div className="flex items-center mt-2 text-sm">
                      <Coins className="w-4 h-4 text-purple-500" />
                      <span className="ml-1 text-purple-600">
                        {portfolioAnalytics.email_analytics?.crypto_email_percentage || 0}% with crypto
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Daily Average</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {portfolioAnalytics.activity_trends?.average_daily_activity?.toFixed(1) || 0}
                        </p>
                      </div>
                      <Calendar className="w-8 h-8 text-orange-500 opacity-75" />
                    </div>
                    <div className="flex items-center mt-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span className="ml-1 text-orange-600">
                        transactions/day
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction Types Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Transaction Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {portfolioAnalytics.transaction_analytics?.transaction_types?.token_transfers || 0}
                      </div>
                      <div className="text-sm text-blue-700">Token Transfers</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {portfolioAnalytics.transaction_analytics?.transaction_types?.nft_transfers || 0}
                      </div>
                      <div className="text-sm text-purple-700">NFT Transfers</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {portfolioAnalytics.transaction_analytics?.transaction_types?.eth_transfers || 0}
                      </div>
                      <div className="text-sm text-green-700">ETH Transfers</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Insights */}
              <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <Star className="w-5 h-5" />
                    AI-Powered Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {portfolioAnalytics.insights?.map((insight, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-white rounded border">
                        <ThumbsUp className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{insight}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Crypto Market Tab */}
        <TabsContent value="market" className="space-y-4">
          {cryptoMarketAnalytics && (
            <>
              {/* Market Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Market Cap</p>
                        <p className="text-xl font-bold">
                          ${(cryptoMarketAnalytics.market_overview?.total_market_cap / 1e12).toFixed(2)}T
                        </p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-blue-500 opacity-75" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">24h Volume</p>
                        <p className="text-xl font-bold">
                          ${(cryptoMarketAnalytics.market_overview?.total_volume_24h / 1e9).toFixed(0)}B
                        </p>
                      </div>
                      <Activity className="w-8 h-8 text-green-500 opacity-75" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">BTC Dominance</p>
                        <p className="text-xl font-bold">
                          {cryptoMarketAnalytics.market_overview?.bitcoin_dominance}%
                        </p>
                      </div>
                      <Crown className="w-8 h-8 text-orange-500 opacity-75" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Fear & Greed</p>
                        <p className="text-xl font-bold">
                          {cryptoMarketAnalytics.market_overview?.fear_greed_index}
                        </p>
                      </div>
                      <Zap className="w-8 h-8 text-purple-500 opacity-75" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Tokens */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Top Performing Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {cryptoMarketAnalytics.top_tokens?.map((token, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">{token.symbol}</span>
                          </div>
                          <div>
                            <div className="font-medium">{token.symbol}</div>
                            <div className="text-sm text-gray-600">
                              Vol: ${(token.volume_24h / 1e9).toFixed(1)}B
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(token.price)}</div>
                          <div className={`text-sm flex items-center ${getTrendColor(token.change_24h)}`}>
                            {getTrendIcon(token.change_24h)}
                            <span className="ml-1">{formatPercentage(token.change_24h)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Market Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="w-5 h-5" />
                    Market Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(cryptoMarketAnalytics.market_trends || {}).map(([key, trend]) => (
                      <div key={key} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{key.replace('_', ' ')}</span>
                          <Badge variant={trend.trend === 'up' ? 'default' : trend.trend === 'down' ? 'destructive' : 'secondary'}>
                            {trend.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : 
                             trend.trend === 'down' ? <TrendingDown className="w-3 h-3 mr-1" /> : 
                             <Activity className="w-3 h-3 mr-1" />}
                            {trend.trend}
                          </Badge>
                        </div>
                        <div className={`text-lg font-bold ${getTrendColor(trend.growth)}`}>
                          {formatPercentage(trend.growth)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Market Recommendations */}
              <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Award className="w-5 h-5" />
                    AI Market Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {cryptoMarketAnalytics.recommendations?.map((recommendation, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-white rounded border">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{recommendation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Risk Assessment Tab */}
        <TabsContent value="risk" className="space-y-4">
          {riskAssessment && (
            <>
              {/* Risk Overview */}
              <Card className={`${getRiskColor(riskAssessment.risk_level)} border`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Risk Assessment
                    <Badge variant="outline" className="capitalize">
                      {riskAssessment.risk_level.replace('_', ' ')} Risk
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Based on your crypto transaction patterns and behavior
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl font-bold">
                      {riskAssessment.risk_score}/100
                    </div>
                    <div className="flex-1">
                      <Progress 
                        value={riskAssessment.risk_score} 
                        className="h-3"
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        Overall Risk Score
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Transactions:</span>
                      <span className="ml-2 font-medium">{riskAssessment.transaction_count}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Unique Addresses:</span>
                      <span className="ml-2 font-medium">{riskAssessment.unique_addresses}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Assessment Date:</span>
                      <span className="ml-2 font-medium">
                        {new Date(riskAssessment.assessment_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Risk Level:</span>
                      <span className="ml-2 font-medium capitalize">
                        {riskAssessment.risk_level.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Factors Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Risk Factors Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(riskAssessment.risk_factors || {}).map(([factor, score]) => (
                      <div key={factor} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize font-medium">
                            {factor.replace('_', ' ')}
                          </span>
                          <span className="font-bold">{score.toFixed(1)}/100</span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Risk Recommendations */}
              {riskAssessment.recommendations && riskAssessment.recommendations.length > 0 && (
                <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-700">
                      <AlertTriangle className="w-5 h-5" />
                      Security Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {riskAssessment.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-white rounded border">
                          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Platform Analytics Tab */}
        <TabsContent value="platform" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Platform Analytics</h3>
                <p className="text-gray-600">
                  Platform-wide analytics are available for admin users. 
                  Contact support to learn more about enterprise features.
                </p>
                {userProfile?.subscription_tier === 'enterprise' && (
                  <Button 
                    onClick={fetchPlatformAnalytics}
                    className="mt-4"
                  >
                    Load Platform Analytics
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;