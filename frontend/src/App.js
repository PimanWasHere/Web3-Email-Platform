import React, { useState, useEffect } from "react";
import "./App.css";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Progress } from "./components/ui/progress";
import { Switch } from "./components/ui/switch";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { 
  Wallet, Mail, Shield, Clock, Hash, CheckCircle, AlertCircle, User, Send, Eye, Plus, X, 
  CreditCard, Crown, Zap, Upload, Download, Lock, Globe, FileText, Users, Settings,
  Star, TrendingUp, Package, Gift, Coins, Diamond, Sparkles
} from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Wallet connection hook
const useWallet = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletType, setWalletType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const connectMetaMask = async () => {
    try {
      setLoading(true);
      setError('');

      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask.');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      setWalletAddress(accounts[0]);
      setWalletType('metamask');
      setWalletConnected(true);
      localStorage.setItem('walletAddress', accounts[0]);
      localStorage.setItem('walletType', 'metamask');

    } catch (error) {
      setError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const connectHashPack = async () => {
    try {
      setLoading(true);
      setError('');
      
      const simulatedAddress = "0.0." + Math.floor(Math.random() * 1000000);
      setWalletAddress(simulatedAddress);
      setWalletType('hashpack');
      setWalletConnected(true);
      localStorage.setItem('walletAddress', simulatedAddress);
      localStorage.setItem('walletType', 'hashpack');
      
      toast.success('HashPack wallet connected!');
    } catch (error) {
      setError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress('');
    setWalletType('');
    setError('');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletType');
    localStorage.removeItem('authToken');
    toast.info('Wallet disconnected');
  };

  const signMessage = async (message) => {
    try {
      if (walletType === 'metamask') {
        if (!window.ethereum) {
          throw new Error('MetaMask not found');
        }
        return await window.ethereum.request({
          method: 'personal_sign',
          params: [message, walletAddress],
        });
      } else if (walletType === 'hashpack') {
        return "0x" + Array.from({length: 130}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      }
      throw new Error('Unsupported wallet type');
    } catch (error) {
      throw new Error(`Signing failed: ${error.message}`);
    }
  };

  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    const savedType = localStorage.getItem('walletType');
    if (savedAddress && savedType) {
      setWalletAddress(savedAddress);
      setWalletType(savedType);
      setWalletConnected(true);
    }
  }, []);

  return {
    walletConnected,
    walletAddress,
    walletType,
    loading,
    error,
    connectMetaMask,
    connectHashPack,
    disconnectWallet,
    signMessage
  };
};

// Authentication service
const useAuth = (wallet) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const authenticate = async () => {
    try {
      setAuthLoading(true);
      
      const challengeResponse = await axios.post(`${API}/auth/challenge`, {
        wallet_address: wallet.walletAddress,
        wallet_type: wallet.walletType
      });

      const challengeData = challengeResponse.data;
      const signature = await wallet.signMessage(challengeData.message);
      
      const verifyResponse = await axios.post(`${API}/auth/verify`, {
        wallet_address: wallet.walletAddress,
        signature: signature,
        challenge_data: challengeData,
        wallet_type: wallet.walletType
      });

      const authResult = verifyResponse.data;
      localStorage.setItem('authToken', authResult.access_token);
      setIsAuthenticated(true);
      
      // Fetch user profile
      await fetchUserProfile();
      
      toast.success('Successfully authenticated!');

    } catch (error) {
      console.error('Authentication failed:', error);
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token && wallet.walletConnected) {
      setIsAuthenticated(true);
      fetchUserProfile();
    } else {
      setIsAuthenticated(false);
    }
  }, [wallet.walletConnected]);

  return {
    isAuthenticated,
    authLoading,
    userProfile,
    authenticate,
    fetchUserProfile
  };
};

// Advanced Email Composer
const AdvancedEmailComposer = ({ userProfile, onEmailSent }) => {
  const [emailData, setEmailData] = useState({
    from_address: '',
    to_addresses: [],
    subject: '',
    body: '',
    attachments: []
  });
  const [newRecipient, setNewRecipient] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [advancedFeatures, setAdvancedFeatures] = useState({
    deliveryGuarantee: false,
    encryptionLevel: 'standard'
  });

  const handleAddRecipient = () => {
    if (newRecipient && !emailData.to_addresses.includes(newRecipient)) {
      setEmailData(prev => ({
        ...prev,
        to_addresses: [...prev.to_addresses, newRecipient]
      }));
      setNewRecipient('');
    }
  };

  const handleRemoveRecipient = (email) => {
    setEmailData(prev => ({
      ...prev,
      to_addresses: prev.to_addresses.filter(addr => addr !== email)
    }));
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setAttachments(prev => [...prev, ...files]);
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendEmail = async () => {
    try {
      setSending(true);
      
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      
      // Add email data
      formData.append('email_data', JSON.stringify(emailData));
      
      // Add attachments
      attachments.forEach((file, index) => {
        formData.append('attachments', file);
      });

      const response = await axios.post(`${API}/emails/send`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        toast.success('Email sent and stored on IPFS with blockchain verification!');
        setEmailData({
          from_address: '',
          to_addresses: [],
          subject: '',
          body: '',
          attachments: []
        });
        setAttachments([]);
        if (onEmailSent) onEmailSent(response.data.timestamp);
      }

    } catch (error) {
      console.error('Send email failed:', error);
      if (error.response?.status === 402) {
        toast.error('Insufficient credits! Please purchase more credits or upgrade your subscription.');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to send email');
      }
    } finally {
      setSending(false);
    }
  };

  const tierConfig = userProfile?.tier_details;
  const hasAdvancedFeatures = tierConfig?.features?.includes('advanced_encryption');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Advanced Email Composer
          {userProfile && (
            <Badge variant={userProfile.subscription_tier === 'basic' ? 'secondary' : 'default'}>
              {userProfile.subscription_tier}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Send blockchain-verified emails with IPFS storage and advanced encryption
        </CardDescription>
        {userProfile && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Coins className="w-4 h-4" />
              Credits: {userProfile.email_credits}
            </span>
            <span className="flex items-center gap-1">
              <Upload className="w-4 h-4" />
              Max attachment: {tierConfig?.max_attachment_size}MB
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            value={emailData.from_address}
            onChange={(e) => setEmailData(prev => ({ ...prev, from_address: e.target.value }))}
            placeholder="your.email@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <div className="flex gap-2">
            <Input
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              placeholder="recipient@example.com"
              onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
            />
            <Button onClick={handleAddRecipient} size="sm" variant="outline">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {emailData.to_addresses.map((email, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {email}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => handleRemoveRecipient(email)}
                />
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={emailData.subject}
            onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="Enter email subject"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            value={emailData.body}
            onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
            placeholder="Compose your message..."
            rows={6}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="attachments">Attachments</Label>
          <div className="flex items-center gap-2">
            <Input
              id="attachments"
              type="file"
              multiple
              onChange={handleFileUpload}
              className="flex-1"
            />
            <Badge variant="outline" className="text-xs">
              {attachments.length} files
            </Badge>
          </div>
          {attachments.length > 0 && (
            <div className="space-y-1">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveAttachment(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasAdvancedFeatures && (
          <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
            <h4 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Premium Features
            </h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Delivery Guarantee
                </Label>
                <p className="text-xs text-gray-600">
                  Cryptographic proof of email delivery
                </p>
              </div>
              <Switch
                checked={advancedFeatures.deliveryGuarantee}
                onCheckedChange={(checked) => 
                  setAdvancedFeatures(prev => ({ ...prev, deliveryGuarantee: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Encryption Level
              </Label>
              <Select
                value={advancedFeatures.encryptionLevel}
                onValueChange={(value) => 
                  setAdvancedFeatures(prev => ({ ...prev, encryptionLevel: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Encryption</SelectItem>
                  <SelectItem value="advanced">Advanced Encryption</SelectItem>
                  <SelectItem value="enterprise">Enterprise Grade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSendEmail}
          disabled={sending || !emailData.from_address || !emailData.to_addresses.length || !emailData.subject || (userProfile?.email_credits || 0) <= 0}
          className="w-full"
        >
          {sending ? 'Sending to IPFS & Blockchain...' : `Send Email (${userProfile?.email_credits || 0} credits remaining)`}
        </Button>
      </CardFooter>
    </Card>
  );
};

// Subscription Management Component
const SubscriptionManager = ({ userProfile, onSubscriptionUpdate }) => {
  const [tiers, setTiers] = useState({});
  const [creditPackages, setCreditPackages] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const [tiersResponse, packagesResponse] = await Promise.all([
        axios.get(`${API}/subscription/tiers`),
        axios.get(`${API}/credits/packages`)
      ]);
      
      setTiers(tiersResponse.data.tiers);
      setCreditPackages(packagesResponse.data.packages);
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
      toast.error('Failed to load subscription options');
    }
  };

  const handleSubscriptionUpgrade = async (tierName) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const originUrl = window.location.origin;

      const response = await axios.post(`${API}/payments/subscription`, {
        package_name: tierName,
        origin_url: originUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Redirect to Stripe Checkout
      window.location.href = response.data.checkout_url;

    } catch (error) {
      console.error('Subscription upgrade failed:', error);
      toast.error('Failed to create subscription payment');
    } finally {
      setLoading(false);
    }
  };

  const handleCreditsPurchase = async (packageName) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const originUrl = window.location.origin;

      const response = await axios.post(`${API}/payments/credits`, {
        package_name: packageName,
        origin_url: originUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Redirect to Stripe Checkout
      window.location.href = response.data.checkout_url;

    } catch (error) {
      console.error('Credits purchase failed:', error);
      toast.error('Failed to create credits payment');
    } finally {
      setLoading(false);
    }
  };

  const getTierIcon = (tierName) => {
    switch (tierName) {
      case 'basic': return <Package className="w-6 h-6" />;
      case 'pro': return <Crown className="w-6 h-6" />;
      case 'enterprise': return <Diamond className="w-6 h-6" />;
      default: return <Package className="w-6 h-6" />;
    }
  };

  const getTierColor = (tierName) => {
    switch (tierName) {
      case 'basic': return 'border-gray-200';
      case 'pro': return 'border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50';
      case 'enterprise': return 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50';
      default: return 'border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{userProfile?.subscription_tier || 'basic'}</div>
              <div className="text-sm text-gray-600">Current Plan</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{userProfile?.email_credits || 0}</div>
              <div className="text-sm text-gray-600">Email Credits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{userProfile?.tier_details?.features?.length || 0}</div>
              <div className="text-sm text-gray-600">Features</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Tiers */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Subscription Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(tiers).map(([tierName, tier]) => (
            <Card key={tierName} className={`${getTierColor(tierName)} transition-all hover:shadow-lg`}>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  {getTierIcon(tierName)}
                </div>
                <CardTitle className="capitalize">{tier.name}</CardTitle>
                <div className="text-3xl font-bold">
                  ${tier.price}
                  {tier.price > 0 && <span className="text-base font-normal">/month</span>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{tier.credits_per_month} emails/month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{tier.max_attachment_size}MB attachments</span>
                  </div>
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm capitalize">{feature.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => handleSubscriptionUpgrade(tierName)}
                  disabled={loading || userProfile?.subscription_tier === tierName}
                  className="w-full"
                  variant={userProfile?.subscription_tier === tierName ? "secondary" : "default"}
                >
                  {userProfile?.subscription_tier === tierName ? 'Current Plan' : 
                   tier.price === 0 ? 'Downgrade' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Credit Packages */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Buy Email Credits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(creditPackages).map(([packageName, packageData]) => (
            <Card key={packageName} className="text-center hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex justify-center mb-2">
                  <Coins className="w-6 h-6 text-yellow-500" />
                </div>
                <CardTitle className="capitalize">{packageName}</CardTitle>
                <div className="text-2xl font-bold text-green-600">
                  ${packageData.price}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold mb-2">
                  {packageData.credits} Credits
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  ${(packageData.price / packageData.credits).toFixed(3)} per email
                </div>
                <Button
                  onClick={() => handleCreditsPurchase(packageName)}
                  disabled={loading}
                  className="w-full"
                >
                  Purchase
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

// Enhanced Email History
const EnhancedEmailHistory = ({ userProfile }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/emails/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmails(response.data.emails);
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      toast.error('Failed to load email history');
    } finally {
      setLoading(false);
    }
  };

  const viewEmailDetails = async (emailId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/emails/${emailId}/retrieve`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedEmail(response.data);
      setShowEmailDialog(true);
    } catch (error) {
      console.error('Failed to retrieve email:', error);
      toast.error('Failed to retrieve email from IPFS');
    }
  };

  const getEncryptionBadge = (level) => {
    const colors = {
      standard: 'bg-blue-100 text-blue-800',
      advanced: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-yellow-100 text-yellow-800'
    };
    return colors[level] || colors.standard;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Email History</h3>
        <Button onClick={fetchEmails} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading emails...</p>
        </div>
      ) : emails.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No emails sent yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {emails.map((email, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-lg">{email.email_data.subject}</h4>
                      <Badge variant="outline" className="text-xs">
                        {new Date(email.timestamp).toLocaleDateString()}
                      </Badge>
                      {email.ipfs_hash && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          IPFS
                        </Badge>
                      )}
                      <Badge className={`text-xs ${getEncryptionBadge(email.encryption_level)}`}>
                        {email.encryption_level}
                      </Badge>
                      {email.delivery_guarantee && (
                        <Badge variant="default" className="text-xs flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Guaranteed
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">
                      To: {email.email_data.to_addresses.join(', ')}
                    </p>
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>Hash: <code className="bg-gray-100 px-1 rounded">{email.content_hash.slice(0, 16)}...</code></p>
                      {email.ipfs_hash && (
                        <p>IPFS: <code className="bg-gray-100 px-1 rounded">{email.ipfs_hash.slice(0, 16)}...</code></p>
                      )}
                      <p>Hedera: <code className="bg-gray-100 px-1 rounded">{email.hedera_transaction_id}</code></p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewEmailDetails(email.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Email Details Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              Blockchain-verified email stored on IPFS
            </DialogDescription>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Subject</Label>
                  <p className="font-medium">{selectedEmail.content.email_data.subject}</p>
                </div>
                <div>
                  <Label>Encryption Level</Label>
                  <Badge className={`${getEncryptionBadge(selectedEmail.metadata.encryption_level)}`}>
                    {selectedEmail.metadata.encryption_level}
                  </Badge>
                </div>
              </div>
              
              <div>
                <Label>Recipients</Label>
                <p>{selectedEmail.content.email_data.to_addresses.join(', ')}</p>
              </div>
              
              <div>
                <Label>Message Body</Label>
                <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm">{selectedEmail.content.email_data.body}</pre>
                </div>
              </div>
              
              <div>
                <Label>Blockchain Verification</Label>
                <div className="bg-blue-50 p-4 rounded border space-y-2">
                  <p className="text-sm"><strong>IPFS Hash:</strong> <code>{selectedEmail.metadata.ipfs_hash}</code></p>
                  <p className="text-sm"><strong>Content Hash:</strong> <code>{selectedEmail.content.content_hash}</code></p>
                  <p className="text-sm"><strong>Timestamp:</strong> {selectedEmail.content.timestamp}</p>
                  <p className="text-sm"><strong>Delivery Guarantee:</strong> {selectedEmail.metadata.delivery_guarantee ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Main App component
function App() {
  const wallet = useWallet();
  const auth = useAuth(wallet);

  // Check for payment success/cancel on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      checkPaymentStatus(sessionId);
    }
  }, []);

  const checkPaymentStatus = async (sessionId) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      let attempts = 0;
      const maxAttempts = 5;
      
      const pollStatus = async () => {
        try {
          const response = await axios.get(`${API}/payments/status/${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data.payment_status === 'paid') {
            toast.success('Payment successful! Your account has been updated.');
            auth.fetchUserProfile(); // Refresh user profile
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          } else if (response.data.status === 'expired') {
            toast.error('Payment session expired.');
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(pollStatus, 2000);
          } else {
            toast.info('Payment status check timed out. Please check your account.');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (error) {
          console.error('Payment status check failed:', error);
        }
      };
      
      pollStatus();
    } catch (error) {
      console.error('Payment status check failed:', error);
    }
  };

  const handleEmailSent = (timestampData) => {
    if (auth.fetchUserProfile) {
      auth.fetchUserProfile(); // Refresh to update credits
    }
  };

  // Landing page when not connected
  if (!wallet.walletConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100">
        <Toaster position="top-right" />
        
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1666816943035-15c29931e975)',
            }}
          />
          <div className="relative z-10 container mx-auto px-4 py-20">
            <div className="text-center max-w-4xl mx-auto">
              <div className="flex justify-center mb-8">
                <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-lg">
                  <Mail className="w-12 h-12 text-white" />
                </div>
              </div>
              
              <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Web3 Email Platform
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                  v2.0 Advanced
                </span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Revolutionary email platform with IPFS decentralized storage, Stripe payments, 
                advanced encryption, and smart contract integration on Hedera network.
              </p>
              
              <div className="grid md:grid-cols-4 gap-6 mb-12">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 transform hover:scale-105 transition-transform">
                  <Crown className="w-10 h-10 text-purple-600 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">Premium Tiers</h3>
                  <p className="text-gray-600">Multiple subscription levels with advanced features</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 transform hover:scale-105 transition-transform">
                  <Globe className="w-10 h-10 text-blue-600 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">IPFS Storage</h3>
                  <p className="text-gray-600">Decentralized storage with encryption</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 transform hover:scale-105 transition-transform">
                  <CreditCard className="w-10 h-10 text-green-600 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">Stripe Payments</h3>
                  <p className="text-gray-600">Secure credit card and subscription payments</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 transform hover:scale-105 transition-transform">
                  <FileText className="w-10 h-10 text-orange-600 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">Smart Contracts</h3>
                  <p className="text-gray-600">Ricardian contracts for email agreements</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  Connect Your Wallet to Access Advanced Features
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="lg" 
                    onClick={wallet.connectMetaMask}
                    disabled={wallet.loading}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  >
                    <Wallet className="w-5 h-5" />
                    {wallet.loading ? 'Connecting...' : 'Connect MetaMask'}
                  </Button>
                  
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={wallet.connectHashPack}
                    disabled={wallet.loading}
                    className="flex items-center gap-2 px-8 py-3"
                  >
                    <Wallet className="w-5 h-5" />
                    Connect HashPack
                  </Button>
                </div>
                
                {wallet.error && (
                  <Alert className="max-w-md mx-auto">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{wallet.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Features Section */}
        <div className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Advanced Web3 Email Features
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Experience the next generation of email communication with blockchain verification, 
                decentralized storage, and enterprise-grade security.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-xl border border-purple-200">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Diamond className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-center">Premium Subscriptions</h3>
                <p className="text-gray-600 text-center">Choose from Basic, Pro, or Enterprise tiers with increasing features and capabilities.</p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-xl border border-blue-200">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-center">Advanced Encryption</h3>
                <p className="text-gray-600 text-center">Multi-level encryption with enterprise-grade security for sensitive communications.</p>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl border border-green-200">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-center">Large Attachments</h3>
                <p className="text-gray-600 text-center">Send files up to 500MB with Enterprise tier, stored securely on IPFS.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard when connected but not authenticated
  if (wallet.walletConnected && !auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100">
        <Toaster position="top-right" />
        
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto">
            <Card className="bg-white shadow-xl">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-indigo-600" />
                </div>
                <CardTitle>Wallet Connected</CardTitle>
                <CardDescription>
                  Authenticate to access Web3 Email Platform v2.0
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-2">
                  <Badge variant="secondary" className="text-sm">
                    {wallet.walletType === 'metamask' ? 'MetaMask' : 'HashPack'}
                  </Badge>
                  <p className="text-sm text-gray-600 font-mono">
                    {wallet.walletAddress}
                  </p>
                </div>
                <Separator />
                <Button 
                  onClick={auth.authenticate}
                  disabled={auth.authLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  {auth.authLoading ? 'Authenticating...' : 'Sign Message to Authenticate'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={wallet.disconnectWallet}
                  className="w-full"
                >
                  Disconnect Wallet
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard when authenticated
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100">
      <Toaster position="top-right" />
      
      {/* Enhanced Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Web3 Email Platform</h1>
                <p className="text-xs text-gray-500">v2.0 Advanced</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    {wallet.walletType === 'metamask' ? 'MetaMask' : 'HashPack'}
                  </Badge>
                  <Badge variant="default" className="flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    {auth.userProfile?.subscription_tier || 'basic'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 font-mono mt-1">
                  {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className="font-semibold">{auth.userProfile?.email_credits || 0}</span>
                </div>
                <p className="text-xs text-gray-600">Credits</p>
              </div>
              <Button 
                variant="outline"
                size="sm"
                onClick={wallet.disconnectWallet}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="compose" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="verify" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Verify
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="compose" className="mt-6">
            <AdvancedEmailComposer 
              userProfile={auth.userProfile} 
              onEmailSent={handleEmailSent} 
            />
          </TabsContent>
          
          <TabsContent value="history" className="mt-6">
            <EnhancedEmailHistory userProfile={auth.userProfile} />
          </TabsContent>
          
          <TabsContent value="subscription" className="mt-6">
            <SubscriptionManager 
              userProfile={auth.userProfile} 
              onSubscriptionUpdate={auth.fetchUserProfile} 
            />
          </TabsContent>
          
          <TabsContent value="verify" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Verify Email Integrity
                </CardTitle>
                <CardDescription>
                  Verify email content against blockchain timestamps
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Email verification feature coming soon in the next update!
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;