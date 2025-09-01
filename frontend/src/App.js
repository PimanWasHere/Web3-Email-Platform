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
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { Wallet, Mail, Shield, Clock, Hash, CheckCircle, AlertCircle, User, Send, Eye, Plus, X } from "lucide-react";
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
      
      // Simulate HashPack connection for demo
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
        // Simulate signing for demo
        return "0x" + Array.from({length: 130}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      }
      throw new Error('Unsupported wallet type');
    } catch (error) {
      throw new Error(`Signing failed: ${error.message}`);
    }
  };

  // Check for existing connection on load
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

  const authenticate = async () => {
    try {
      setAuthLoading(true);
      
      // Create challenge
      const challengeResponse = await axios.post(`${API}/auth/challenge`, {
        wallet_address: wallet.walletAddress,
        wallet_type: wallet.walletType
      });

      const challengeData = challengeResponse.data;
      
      // Sign challenge
      const signature = await wallet.signMessage(challengeData.message);
      
      // Verify signature
      const verifyResponse = await axios.post(`${API}/auth/verify`, {
        wallet_address: wallet.walletAddress,
        signature: signature,
        challenge_data: challengeData,
        wallet_type: wallet.walletType
      });

      const authResult = verifyResponse.data;
      localStorage.setItem('authToken', authResult.access_token);
      setIsAuthenticated(true);
      toast.success('Successfully authenticated!');

    } catch (error) {
      console.error('Authentication failed:', error);
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Check for existing auth token
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token && wallet.walletConnected) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, [wallet.walletConnected]);

  return {
    isAuthenticated,
    authLoading,
    authenticate
  };
};

// Email composer component
const EmailComposer = ({ onEmailSent }) => {
  const [emailData, setEmailData] = useState({
    from_address: '',
    to_addresses: [],
    subject: '',
    body: '',
    attachments: []
  });
  const [newRecipient, setNewRecipient] = useState('');
  const [sending, setSending] = useState(false);

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

  const handleSendEmail = async () => {
    try {
      setSending(true);
      
      const token = localStorage.getItem('authToken');
      const response = await axios.post(`${API}/emails/timestamp`, {
        email_data: emailData
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        toast.success('Email sent and timestamped on Hedera!');
        // Reset form
        setEmailData({
          from_address: '',
          to_addresses: [],
          subject: '',
          body: '',
          attachments: []
        });
        if (onEmailSent) onEmailSent(response.data.timestamp);
      }

    } catch (error) {
      console.error('Send email failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Compose Email
        </CardTitle>
        <CardDescription>
          Send an email with blockchain verification on Hedera network
        </CardDescription>
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
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSendEmail}
          disabled={sending || !emailData.from_address || !emailData.to_addresses.length || !emailData.subject}
          className="w-full"
        >
          {sending ? 'Sending & Timestamping...' : 'Send Email'}
        </Button>
      </CardFooter>
    </Card>
  );
};

// Email verification component
const EmailVerifier = () => {
  const [emailData, setEmailData] = useState({
    from_address: '',
    to_addresses: [],
    subject: '',
    body: '',
    attachments: []
  });
  const [storedHash, setStoredHash] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerifyEmail = async () => {
    try {
      setVerifying(true);
      
      const token = localStorage.getItem('authToken');
      const response = await axios.post(`${API}/emails/verify`, {
        email_data: emailData,
        stored_hash: storedHash
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setVerificationResult(response.data);
      toast.success(response.data.valid ? 'Email verified successfully!' : 'Email verification failed!');

    } catch (error) {
      console.error('Verify email failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to verify email');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Verify Email
        </CardTitle>
        <CardDescription>
          Verify email integrity against blockchain timestamp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="hash">Stored Hash</Label>
          <Input
            id="hash"
            value={storedHash}
            onChange={(e) => setStoredHash(e.target.value)}
            placeholder="Enter the stored email hash"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="verify-from">From</Label>
          <Input
            id="verify-from"
            value={emailData.from_address}
            onChange={(e) => setEmailData(prev => ({ ...prev, from_address: e.target.value }))}
            placeholder="sender@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="verify-subject">Subject</Label>
          <Input
            id="verify-subject"
            value={emailData.subject}
            onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="Enter email subject"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="verify-body">Message</Label>
          <Textarea
            id="verify-body"
            value={emailData.body}
            onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
            placeholder="Enter email message..."
            rows={4}
          />
        </div>

        {verificationResult && (
          <Alert className={verificationResult.valid ? "border-green-500" : "border-red-500"}>
            {verificationResult.valid ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {verificationResult.valid 
                ? "Email verified! The content matches the blockchain timestamp."
                : "Verification failed! The content doesn't match the stored hash."
              }
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleVerifyEmail}
          disabled={verifying || !storedHash || !emailData.from_address || !emailData.subject}
          className="w-full"
        >
          {verifying ? 'Verifying...' : 'Verify Email'}
        </Button>
      </CardFooter>
    </Card>
  );
};

// Main App component
function App() {
  const wallet = useWallet();
  const auth = useAuth(wallet);
  const [userEmails, setUserEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const fetchUserEmails = async () => {
    try {
      setLoadingEmails(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API}/emails/user`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setUserEmails(response.data.emails);
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoadingEmails(false);
    }
  };

  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchUserEmails();
    }
  }, [auth.isAuthenticated]);

  const handleEmailSent = (timestampData) => {
    fetchUserEmails(); // Refresh email list
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
                <div className="p-4 bg-indigo-600 rounded-full">
                  <Mail className="w-12 h-12 text-white" />
                </div>
              </div>
              
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Web3 Enhanced Email Platform
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Experience the future of email with blockchain verification, Ricardian smart contracts, 
                and Hedera network integration. Every email is timestamped and cryptographically secured.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                  <Shield className="w-10 h-10 text-indigo-600 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">Blockchain Verified</h3>
                  <p className="text-gray-600">Every email is cryptographically timestamped on Hedera network</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                  <Clock className="w-10 h-10 text-indigo-600 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">Immutable Timestamps</h3>
                  <p className="text-gray-600">Hedera Consensus Service provides tamper-proof timestamps</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                  <Hash className="w-10 h-10 text-indigo-600 mb-4 mx-auto" />
                  <h3 className="text-lg font-semibold mb-2">Smart Contracts</h3>
                  <p className="text-gray-600">Ricardian contracts for email terms and agreements</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                  Connect Your Wallet to Get Started
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="lg" 
                    onClick={wallet.connectMetaMask}
                    disabled={wallet.loading}
                    className="flex items-center gap-2 px-8 py-3"
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
        
        {/* Features Section */}
        <div className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Why Choose Web3 Email?
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Traditional email lacks verification and proof of authenticity. Our platform solves this with blockchain technology.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Wallet Authentication</h3>
                <p className="text-gray-600">Secure login with MetaMask or HashPack wallet</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Email Verification</h3>
                <p className="text-gray-600">Cryptographic proof of email authenticity</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Decentralized</h3>
                <p className="text-gray-600">No single point of failure or censorship</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Timestamps</h3>
                <p className="text-gray-600">Immutable proof of when emails were sent</p>
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
            <Card>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-indigo-600" />
                </div>
                <CardTitle>Wallet Connected</CardTitle>
                <CardDescription>
                  Authenticate with your wallet to access the platform
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
                  className="w-full"
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
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Web3 Email Platform</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                {wallet.walletType === 'metamask' ? 'MetaMask' : 'HashPack'}
              </Badge>
              <p className="text-sm text-gray-600 font-mono">
                {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
              </p>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose">Compose Email</TabsTrigger>
            <TabsTrigger value="verify">Verify Email</TabsTrigger>
            <TabsTrigger value="history">Email History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="compose" className="mt-6">
            <EmailComposer onEmailSent={handleEmailSent} />
          </TabsContent>
          
          <TabsContent value="verify" className="mt-6">
            <EmailVerifier />
          </TabsContent>
          
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Email History
                </CardTitle>
                <CardDescription>
                  Your blockchain-verified emails
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEmails ? (
                  <p className="text-center py-8 text-gray-500">Loading emails...</p>
                ) : userEmails.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No emails sent yet</p>
                ) : (
                  <div className="space-y-4">
                    {userEmails.map((email, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-lg">{email.email_data.subject}</h3>
                          <Badge variant="outline">
                            {new Date(email.timestamp).toLocaleDateString()}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-2">
                          To: {email.email_data.to_addresses.join(', ')}
                        </p>
                        <div className="text-sm text-gray-500 space-y-1">
                          <p>Hash: <code className="bg-gray-100 px-1 rounded">{email.content_hash}</code></p>
                          <p>Transaction: <code className="bg-gray-100 px-1 rounded">{email.hedera_transaction_id}</code></p>
                          <p>Topic: <code className="bg-gray-100 px-1 rounded">{email.hedera_topic_id}</code></p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;