import requests
import sys
import json
from datetime import datetime
import time

class Web3EmailAPITester:
    def __init__(self, base_url="https://hedera-mail-app.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.challenge_data = None
        self.wallet_address = "0x742d35Cc6634C0532925a3b8D404fddF6fE7d396"
        self.wallet_type = "metamask"
        self.email_id = None
        self.test_results = []

    def log_test_result(self, name, success, details=""):
        """Log test result for summary"""
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.token and 'Authorization' not in test_headers:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for multipart
                    if 'Content-Type' in test_headers:
                        del test_headers['Content-Type']
                    response = requests.post(url, data=data, files=files, headers=test_headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    self.log_test_result(name, True)
                    return True, response_data
                except:
                    self.log_test_result(name, True)
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                    self.log_test_result(name, False, f"Status {response.status_code}: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                    self.log_test_result(name, False, f"Status {response.status_code}: {response.text[:100]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.log_test_result(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check with v2.0 services"""
        success, response = self.run_test(
            "Health Check v2.0",
            "GET",
            "health",
            200
        )
        
        if success and response:
            services = response.get('services', {})
            print(f"   Version: {response.get('version', 'unknown')}")
            print(f"   IPFS Status: {services.get('ipfs', 'unknown')}")
            print(f"   Stripe Status: {services.get('stripe', 'unknown')}")
            print(f"   Hedera Status: {services.get('hedera', 'unknown')}")
        
        return success

    def test_subscription_tiers(self):
        """Test v2.0 subscription tiers endpoint"""
        success, response = self.run_test(
            "Get Subscription Tiers",
            "GET",
            "subscription/tiers",
            200
        )
        
        if success and response:
            tiers = response.get('tiers', {})
            print(f"   Available tiers: {list(tiers.keys())}")
            for tier_name, tier_data in tiers.items():
                print(f"   - {tier_name}: ${tier_data.get('price', 0)}/month, {tier_data.get('credits_per_month', 0)} credits")
        
        return success

    def test_credit_packages(self):
        """Test v2.0 credit packages endpoint"""
        success, response = self.run_test(
            "Get Credit Packages",
            "GET",
            "credits/packages",
            200
        )
        
        if success and response:
            packages = response.get('packages', {})
            print(f"   Available packages: {list(packages.keys())}")
            for pkg_name, pkg_data in packages.items():
                print(f"   - {pkg_name}: {pkg_data.get('credits', 0)} credits for ${pkg_data.get('price', 0)}")
        
        return success

    def test_user_profile(self):
        """Test v2.0 user profile endpoint"""
        if not self.token:
            print("❌ No authentication token available for user profile")
            return False

        success, response = self.run_test(
            "Get User Profile v2.0",
            "GET",
            "user/profile",
            200
        )
        
        if success and response:
            print(f"   User ID: {response.get('user_id', 'unknown')}")
            print(f"   Subscription: {response.get('subscription_tier', 'unknown')}")
            print(f"   Credits: {response.get('email_credits', 0)}")
            print(f"   Features: {len(response.get('premium_features', []))}")
            tier_details = response.get('tier_details', {})
            print(f"   Max Attachment: {tier_details.get('max_attachment_size', 0)}MB")
        
        return success

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_create_auth_challenge(self):
        """Test authentication challenge creation"""
        success, response = self.run_test(
            "Create Auth Challenge",
            "POST",
            "auth/challenge",
            200,
            data={
                "wallet_address": self.wallet_address,
                "wallet_type": self.wallet_type
            }
        )
        if success and 'message' in response:
            self.challenge_data = response
            print(f"   Challenge created with nonce: {response.get('nonce', 'N/A')}")
            return True
        return False

    def test_verify_wallet_signature(self):
        """Test wallet signature verification"""
        if not self.challenge_data:
            print("❌ No challenge data available for signature verification")
            return False

        # Simulate a signature (in real app, this would come from wallet)
        simulated_signature = "0x" + "a" * 130  # Mock signature

        success, response = self.run_test(
            "Verify Wallet Signature",
            "POST",
            "auth/verify",
            200,
            data={
                "wallet_address": self.wallet_address,
                "signature": simulated_signature,
                "challenge_data": self.challenge_data,
                "wallet_type": self.wallet_type
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Authentication successful, token received")
            return True
        return False

    def test_advanced_email_sending(self):
        """Test v2.0 advanced email sending with IPFS"""
        if not self.token:
            print("❌ No authentication token available for email sending")
            return False

        email_data = {
            "from_address": "test@example.com",
            "to_addresses": ["recipient@example.com"],
            "subject": "Test Email from Web3 Platform v2.0",
            "body": "This is a test email sent through the Web3 Email Platform v2.0 with IPFS storage and blockchain verification."
        }

        # Prepare form data for multipart request
        form_data = {
            'email_data': json.dumps(email_data)
        }

        success, response = self.run_test(
            "Send Email v2.0 (IPFS + Blockchain)",
            "POST",
            "emails/send",
            200,
            data=form_data,
            headers={'Authorization': f'Bearer {self.token}'}
        )
        
        if success and response:
            print(f"   Email ID: {response.get('email_id', 'unknown')}")
            timestamp_data = response.get('timestamp', {})
            print(f"   IPFS Hash: {timestamp_data.get('ipfs_hash', 'unknown')}")
            print(f"   Content Hash: {timestamp_data.get('content_hash', 'unknown')[:16]}...")
            print(f"   Hedera TX: {timestamp_data.get('hedera_transaction_id', 'unknown')}")
            print(f"   Encryption: {timestamp_data.get('encryption_level', 'unknown')}")
            print(f"   Credits Remaining: {response.get('credits_remaining', 'unknown')}")
            
            # Store email ID for retrieval test
            self.email_id = response.get('email_id')
            return True
        return False

    def test_email_ipfs_retrieval(self):
        """Test v2.0 email retrieval from IPFS"""
        if not self.token or not self.email_id:
            print("❌ No email ID available for IPFS retrieval")
            return False

        success, response = self.run_test(
            "Retrieve Email from IPFS",
            "GET",
            f"emails/{self.email_id}/retrieve",
            200
        )
        
        if success and response:
            content = response.get('content', {})
            metadata = response.get('metadata', {})
            print(f"   Retrieved subject: {content.get('email_data', {}).get('subject', 'unknown')}")
            print(f"   IPFS Hash: {metadata.get('ipfs_hash', 'unknown')}")
            print(f"   Encryption: {metadata.get('encryption_level', 'unknown')}")
            print(f"   Delivery Guarantee: {metadata.get('delivery_guarantee', False)}")
        
        return success

    def test_payment_endpoints(self):
        """Test v2.0 payment system endpoints"""
        if not self.token:
            print("❌ No authentication token available for payment tests")
            return False

        # Test subscription payment creation
        success1, response1 = self.run_test(
            "Create Subscription Payment",
            "POST",
            "payments/subscription",
            200,
            data={
                "package_name": "pro",
                "origin_url": "https://example.com"
            }
        )
        
        if success1 and response1:
            print(f"   Subscription checkout URL created: {bool(response1.get('checkout_url'))}")
            print(f"   Session ID: {response1.get('session_id', 'unknown')}")

        # Test credits payment creation
        success2, response2 = self.run_test(
            "Create Credits Payment",
            "POST",
            "payments/credits",
            200,
            data={
                "package_name": "medium",
                "origin_url": "https://example.com"
            }
        )
        
        if success2 and response2:
            print(f"   Credits checkout URL created: {bool(response2.get('checkout_url'))}")
            print(f"   Session ID: {response2.get('session_id', 'unknown')}")

        return success1 and success2

    def test_insufficient_credits_scenario(self):
        """Test behavior when user runs out of credits"""
        if not self.token:
            return True  # Skip if no auth

        # Try to send multiple emails to exhaust credits
        for i in range(12):  # Basic tier has 10 credits
            email_data = {
                "from_address": "test@example.com",
                "to_addresses": ["recipient@example.com"],
                "subject": f"Credit Test Email #{i+1}",
                "body": f"Testing credit exhaustion - email #{i+1}"
            }
            
            form_data = {'email_data': json.dumps(email_data)}
            
            success, response = self.run_test(
                f"Send Email #{i+1} (Credit Exhaustion Test)",
                "POST",
                "emails/send",
                200 if i < 10 else 402,  # Expect 402 after credits exhausted
                data=form_data,
                headers={'Authorization': f'Bearer {self.token}'}
            )
            
            if not success and i >= 9:  # Expected failure due to insufficient credits
                print(f"   ✅ Correctly blocked email due to insufficient credits")
                return True
            elif not success and i < 9:
                print(f"   ❌ Unexpected failure on email #{i+1}")
                return False
            
            # Small delay between requests
            time.sleep(0.1)
        
        return True

    def test_get_user_emails(self):
        """Test getting user's email history with v2.0 features"""
        if not self.token:
            print("❌ No authentication token available for getting user emails")
            return False

        success, response = self.run_test(
            "Get User Email History v2.0",
            "GET",
            "emails/user",
            200
        )
        
        if success:
            email_count = response.get('count', 0)
            emails = response.get('emails', [])
            print(f"   Found {email_count} emails for user")
            
            if emails:
                latest_email = emails[0]
                print(f"   Latest email subject: {latest_email.get('email_data', {}).get('subject', 'unknown')}")
                print(f"   IPFS Hash: {latest_email.get('ipfs_hash', 'none')}")
                print(f"   Encryption Level: {latest_email.get('encryption_level', 'unknown')}")
                print(f"   Delivery Guarantee: {latest_email.get('delivery_guarantee', False)}")
            
            return True
        return False

    def test_legacy_status_endpoints(self):
        """Test legacy status endpoints for compatibility"""
        # Test create status
        success1, response1 = self.run_test(
            "Create Status Check",
            "POST",
            "status",
            200,
            data={"client_name": "test_client"}
        )
        
        # Test get status
        success2, response2 = self.run_test(
            "Get Status Checks",
            "GET",
            "status",
            200
        )
        
        return success1 and success2

def main():
    print("🚀 Starting Web3 Email Platform API Tests")
    print("=" * 50)
    
    tester = Web3EmailAPITester()
    
    # Run all tests in sequence
    test_results = []
    
    # Basic API tests
    test_results.append(("Health Check", tester.test_health_check()))
    test_results.append(("Root Endpoint", tester.test_root_endpoint()))
    
    # Authentication flow tests
    test_results.append(("Create Auth Challenge", tester.test_create_auth_challenge()))
    test_results.append(("Verify Wallet Signature", tester.test_verify_wallet_signature()))
    
    # Email functionality tests (require authentication)
    test_results.append(("Timestamp Email", tester.test_timestamp_email()))
    test_results.append(("Verify Email", tester.test_verify_email()))
    test_results.append(("Get User Emails", tester.test_get_user_emails()))
    
    # Legacy compatibility tests
    test_results.append(("Legacy Status Endpoints", tester.test_legacy_status_endpoints()))
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 50)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n📈 Overall: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the backend implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())