import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { 
  Bot, Lightbulb, TrendingUp, FileText, Sparkles, 
  AlertCircle, CheckCircle, Zap, Brain, MessageSquare,
  Code, Coins, Shield, Clock
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AIAssistant = ({ userProfile }) => {
  const [activeTab, setActiveTab] = useState('generate');
  const [loading, setLoading] = useState(false);
  
  // Email Generation State
  const [emailContext, setEmailContext] = useState({
    recipient: '',
    subject_hint: '',
    tone: 'professional',
    purpose: '',
    key_points: []
  });
  const [generatedEmail, setGeneratedEmail] = useState(null);
  const [newKeyPoint, setNewKeyPoint] = useState('');
  
  // Sentiment Analysis State
  const [emailContent, setEmailContent] = useState('');
  const [sentimentAnalysis, setSentimentAnalysis] = useState(null);
  
  // Crypto Suggestions State
  const [cryptoSuggestions, setCryptoSuggestions] = useState([]);
  
  // Smart Contract State
  const [contractType, setContractType] = useState('escrow');
  const [contractParams, setContractParams] = useState({
    amount: '1.0',
    parties: ['Party A', 'Party B'],
    terms: ['Term 1', 'Term 2']
  });
  const [generatedContract, setGeneratedContract] = useState(null);

  const generateAIEmail = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await axios.post(`${API}/ai/generate-email`, emailContext, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setGeneratedEmail(response.data.generated_content);
        toast.success('AI email generated successfully!');
      }
      
    } catch (error) {
      console.error('Failed to generate AI email:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate email');
    } finally {
      setLoading(false);
    }
  };

  const analyzeEmailSentiment = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await axios.post(`${API}/ai/analyze-sentiment`, {
        email_content: emailContent
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSentimentAnalysis(response.data.analysis);
        await getCryptoSuggestions(); // Also get crypto suggestions
        toast.success('Email analysis completed!');
      }
      
    } catch (error) {
      console.error('Failed to analyze sentiment:', error);
      toast.error(error.response?.data?.detail || 'Failed to analyze email');
    } finally {
      setLoading(false);
    }
  };

  const getCryptoSuggestions = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await axios.post(`${API}/ai/suggest-crypto`, {
        email_content: emailContent
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCryptoSuggestions(response.data.suggestions);
      }
      
    } catch (error) {
      console.error('Failed to get crypto suggestions:', error);
    }
  };

  const generateSmartContract = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await axios.post(`${API}/ai/smart-contract-template`, {
        contract_type: contractType,
        parameters: contractParams
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setGeneratedContract(response.data.template);
        toast.success('Smart contract template generated!');
      }
      
    } catch (error) {
      console.error('Failed to generate smart contract:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate contract');
    } finally {
      setLoading(false);
    }
  };

  const addKeyPoint = () => {
    if (newKeyPoint.trim()) {
      setEmailContext(prev => ({
        ...prev,
        key_points: [...prev.key_points, newKeyPoint.trim()]
      }));
      setNewKeyPoint('');
    }
  };

  const removeKeyPoint = (index) => {
    setEmailContext(prev => ({
      ...prev,
      key_points: prev.key_points.filter((_, i) => i !== index)
    }));
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200';
      case 'negative': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case 'positive': return <CheckCircle className="w-4 h-4" />;
      case 'negative': return <AlertCircle className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* AI Assistant Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-600" />
            AI Email Assistant
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              <Sparkles className="w-3 h-3 mr-1" />
              Powered by AI
            </Badge>
          </CardTitle>
          <CardDescription>
            Generate emails, analyze sentiment, get crypto suggestions, and create smart contracts with AI
          </CardDescription>
        </CardHeader>
      </Card>

      {/* AI Assistant Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="crypto" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Crypto AI
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Contracts
          </TabsTrigger>
        </TabsList>

        {/* Email Generation Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI Email Generator
              </CardTitle>
              <CardDescription>
                Generate professional emails with AI assistance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Input
                    placeholder="Enter recipient name"
                    value={emailContext.recipient}
                    onChange={(e) => setEmailContext(prev => ({ ...prev, recipient: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Email Tone</Label>
                  <Select value={emailContext.tone} onValueChange={(value) => setEmailContext(prev => ({ ...prev, tone: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subject Hint</Label>
                <Input
                  placeholder="Brief description of email topic"
                  value={emailContext.subject_hint}
                  onChange={(e) => setEmailContext(prev => ({ ...prev, subject_hint: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Purpose</Label>
                <Textarea
                  placeholder="What is the main purpose of this email?"
                  value={emailContext.purpose}
                  onChange={(e) => setEmailContext(prev => ({ ...prev, purpose: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Key Points</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a key point"
                    value={newKeyPoint}
                    onChange={(e) => setNewKeyPoint(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addKeyPoint()}
                  />
                  <Button onClick={addKeyPoint} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {emailContext.key_points.map((point, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeKeyPoint(index)}>
                      {point} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <Button 
                onClick={generateAIEmail} 
                disabled={loading || !emailContext.recipient}
                className="w-full"
              >
                {loading ? 'Generating...' : 'Generate AI Email'}
              </Button>

              {generatedEmail && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-green-700 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Generated Email
                      <Badge variant="outline">Confidence: {generatedEmail.confidence * 100}%</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Subject:</Label>
                      <div className="bg-white p-2 rounded border">
                        {generatedEmail.subject}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Body:</Label>
                      <div className="bg-white p-3 rounded border whitespace-pre-wrap">
                        {generatedEmail.body}
                      </div>
                    </div>
                    <Button onClick={() => copyToClipboard(generatedEmail.body)} variant="outline" size="sm">
                      Copy Email
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Analysis Tab */}
        <TabsContent value="analyze" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Email Sentiment Analysis
              </CardTitle>
              <CardDescription>
                Analyze email tone and get improvement suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email Content</Label>
                <Textarea
                  placeholder="Paste your email content here for analysis..."
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  rows={6}
                />
              </div>

              <Button 
                onClick={analyzeEmailSentiment} 
                disabled={loading || !emailContent.trim()}
                className="w-full"
              >
                {loading ? 'Analyzing...' : 'Analyze Email'}
              </Button>

              {sentimentAnalysis && (
                <div className="space-y-4">
                  <Card className={`${getSentimentColor(sentimentAnalysis.sentiment)} border`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getSentimentIcon(sentimentAnalysis.sentiment)}
                          <span className="font-medium capitalize">{sentimentAnalysis.sentiment} Sentiment</span>
                        </div>
                        <Badge variant="outline">
                          Score: {sentimentAnalysis.sentiment_score}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Words:</span> {sentimentAnalysis.word_count}
                        </div>
                        <div>
                          <span className="font-medium">Positive:</span> {sentimentAnalysis.positive_indicators}
                        </div>
                        <div>
                          <span className="font-medium">Negative:</span> {sentimentAnalysis.negative_indicators}
                        </div>
                        <div>
                          <span className="font-medium">Urgency:</span> {sentimentAnalysis.urgency_level}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {sentimentAnalysis.suggestions.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          AI Suggestions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {sentimentAnalysis.suggestions.map((suggestion, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <Sparkles className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Crypto AI Tab */}
        <TabsContent value="crypto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Crypto Opportunity AI
              </CardTitle>
              <CardDescription>
                Get AI-powered crypto suggestions based on your email content
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cryptoSuggestions.length > 0 ? (
                <div className="space-y-3">
                  {cryptoSuggestions.map((suggestion, index) => (
                    <Card key={index} className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-green-700">{suggestion.title}</h4>
                          <Badge variant="outline">
                            {Math.round(suggestion.confidence * 100)}% match
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300">
                          {suggestion.action}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    Analyze an email in the "Analyze" tab to get AI-powered crypto suggestions!
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Smart Contract Tab */}
        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Smart Contract Generator
              </CardTitle>
              <CardDescription>
                Generate smart contract templates for email agreements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contract Type</Label>
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escrow">Escrow Agreement</SelectItem>
                    <SelectItem value="recurring_payment">Recurring Payment</SelectItem>
                    <SelectItem value="milestone">Milestone Payment</SelectItem>
                    <SelectItem value="basic">Basic Agreement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount (ETH)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={contractParams.amount}
                  onChange={(e) => setContractParams(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              <Button 
                onClick={generateSmartContract} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Generating...' : 'Generate Smart Contract'}
              </Button>

              {generatedContract && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-700 flex items-center gap-2">
                      <Code className="w-5 h-5" />
                      {generatedContract.name}
                    </CardTitle>
                    <CardDescription>{generatedContract.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-x-auto">
                      <pre>{generatedContract.template}</pre>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => copyToClipboard(generatedContract.template)} variant="outline" size="sm">
                        Copy Contract
                      </Button>
                      <Badge variant="secondary">{generatedContract.language}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIAssistant;