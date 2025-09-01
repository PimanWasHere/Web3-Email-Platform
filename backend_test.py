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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
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
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
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

    def test_timestamp_email(self):
        """Test email timestamping"""
        if not self.token:
            print("❌ No authentication token available for email timestamping")
            return False

        email_data = {
            "from_address": "test@example.com",
            "to_addresses": ["recipient@example.com"],
            "subject": "Test Email for Blockchain Timestamping",
            "body": "This is a test email to verify the timestamping functionality.",
            "attachments": []
        }

        success, response = self.run_test(
            "Timestamp Email",
            "POST",
            "emails/timestamp",
            200,
            data={
                "email_data": email_data,
                "metadata": {"test": True}
            }
        )
        
        if success and response.get('success'):
            timestamp_info = response.get('timestamp', {})
            print(f"   Email timestamped with hash: {timestamp_info.get('content_hash', 'N/A')[:16]}...")
            print(f"   Hedera Transaction ID: {timestamp_info.get('hedera_transaction_id', 'N/A')}")
            self.test_email_hash = timestamp_info.get('content_hash')
            return True
        return False

    def test_verify_email(self):
        """Test email verification"""
        if not self.token:
            print("❌ No authentication token available for email verification")
            return False

        if not hasattr(self, 'test_email_hash'):
            print("❌ No email hash available for verification")
            return False

        email_data = {
            "from_address": "test@example.com",
            "to_addresses": ["recipient@example.com"],
            "subject": "Test Email for Blockchain Timestamping",
            "body": "This is a test email to verify the timestamping functionality.",
            "attachments": []
        }

        # Test with correct data (should verify successfully)
        success, response = self.run_test(
            "Verify Email (Valid)",
            "POST",
            f"emails/verify?stored_hash={self.test_email_hash}",
            200,
            data=email_data
        )
        
        if success and response.get('valid'):
            print(f"   Email verification successful")
            return True
        return False

    def test_get_user_emails(self):
        """Test getting user's email history"""
        if not self.token:
            print("❌ No authentication token available for getting user emails")
            return False

        success, response = self.run_test(
            "Get User Emails",
            "GET",
            "emails/user",
            200
        )
        
        if success:
            email_count = response.get('count', 0)
            print(f"   Found {email_count} emails for user")
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