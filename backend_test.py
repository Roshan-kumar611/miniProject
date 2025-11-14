import requests
import sys
import json
from datetime import datetime

class FleetManagerAPITester:
    def __init__(self, base_url="https://tripwise-fleet.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.vehicle_id = None
        self.trip_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        # Try to login with the registered user
        if not self.token:
            return False
            
        # Test /auth/me endpoint to verify token
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_vehicle_management(self):
        """Test vehicle CRUD operations"""
        # Create vehicle
        vehicle_data = {
            "name": "Test Truck 1",
            "vehicle_type": "truck",
            "registration_number": "DL-01-AB-1234",
            "fuel_type": "diesel"
        }
        
        success, response = self.run_test(
            "Create Vehicle",
            "POST",
            "vehicles",
            200,
            data=vehicle_data
        )
        
        if success and 'id' in response:
            self.vehicle_id = response['id']
            print(f"   Vehicle ID: {self.vehicle_id}")
        
        # Get vehicles
        success, response = self.run_test(
            "Get Vehicles",
            "GET",
            "vehicles",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            print(f"   Found {len(response)} vehicles")
        
        # Update vehicle location
        if self.vehicle_id:
            location_data = {"lat": 28.6139, "lng": 77.2090}
            success, response = self.run_test(
                "Update Vehicle Location",
                "PUT",
                f"vehicles/{self.vehicle_id}/location",
                200,
                data=location_data
            )
        
        return success

    def test_route_calculation(self):
        """Test route calculation"""
        route_data = {
            "start": {"lat": 28.6139, "lng": 77.2090},
            "end": {"lat": 28.7041, "lng": 77.1025},
            "vehicle_fuel_type": "diesel"
        }
        
        success, response = self.run_test(
            "Calculate Routes",
            "POST",
            "routes/calculate",
            200,
            data=route_data
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} route options")
            for route in response:
                print(f"   - {route.get('route_type', 'unknown')}: {route.get('distance', 0)} km, {route.get('duration', 0)} min")
        
        return success

    def test_trip_management(self):
        """Test trip CRUD operations"""
        if not self.vehicle_id:
            print("❌ No vehicle ID available for trip testing")
            return False
            
        # Create trip
        trip_data = {
            "vehicle_id": self.vehicle_id,
            "start_location": {"lat": 28.6139, "lng": 77.2090},
            "end_location": {"lat": 28.7041, "lng": 77.1025},
            "route_type": "fastest",
            "distance": 25.5,
            "duration": 45.0
        }
        
        success, response = self.run_test(
            "Create Trip",
            "POST",
            "trips",
            200,
            data=trip_data
        )
        
        if success and 'id' in response:
            self.trip_id = response['id']
            print(f"   Trip ID: {self.trip_id}")
        
        # Get trips
        success, response = self.run_test(
            "Get Trips",
            "GET",
            "trips",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} trips")
        
        # Start trip
        if self.trip_id:
            success, response = self.run_test(
                "Start Trip",
                "PUT",
                f"trips/{self.trip_id}/start",
                200
            )
            
            # Complete trip
            if success:
                success, response = self.run_test(
                    "Complete Trip",
                    "PUT",
                    f"trips/{self.trip_id}/complete",
                    200
                )
        
        return success

    def test_fastag_payments(self):
        """Test FASTag payment processing"""
        if not self.vehicle_id:
            print("❌ No vehicle ID available for FASTag testing")
            return False
            
        # Process payment
        payment_data = {
            "vehicle_id": self.vehicle_id,
            "toll_name": "Test Toll Plaza",
            "amount": 50.0,
            "location": {"lat": 28.6139, "lng": 77.2090}
        }
        
        success, response = self.run_test(
            "Process FASTag Payment",
            "POST",
            "fastag/process",
            200,
            data=payment_data
        )
        
        if success:
            print(f"   Payment status: {response.get('status', 'unknown')}")
        
        # Get transactions
        success, response = self.run_test(
            "Get FASTag Transactions",
            "GET",
            "fastag/transactions",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} transactions")
        
        return success

    def test_nearby_locations(self):
        """Test nearby locations endpoint"""
        params = {
            "lat": 28.6139,
            "lng": 77.2090,
            "type": "petrol_pump",
            "radius": 50.0
        }
        
        success, response = self.run_test(
            "Get Nearby Petrol Pumps",
            "GET",
            "locations/nearby",
            200,
            params=params
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} nearby locations")
        
        # Test charging stations
        params["type"] = "charging_station"
        success, response = self.run_test(
            "Get Nearby Charging Stations",
            "GET",
            "locations/nearby",
            200,
            params=params
        )
        
        return success

    def test_safety_alerts(self):
        """Test safety alerts endpoint"""
        params = {
            "lat": 28.6139,
            "lng": 77.2090
        }
        
        success, response = self.run_test(
            "Get Safety Alerts",
            "GET",
            "safety/alerts",
            200,
            params=params
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} safety alerts")
        
        return success

    def cleanup_test_data(self):
        """Clean up test data"""
        if self.vehicle_id:
            self.run_test(
                "Delete Test Vehicle",
                "DELETE",
                f"vehicles/{self.vehicle_id}",
                200
            )

def main():
    print("🚀 Starting Fleet Manager API Tests")
    print("=" * 50)
    
    tester = FleetManagerAPITester()
    
    # Run all tests
    try:
        # Authentication tests
        if not tester.test_user_registration():
            print("❌ Registration failed, stopping tests")
            return 1
        
        if not tester.test_user_login():
            print("❌ Login verification failed, stopping tests")
            return 1
        
        # Core functionality tests
        tester.test_vehicle_management()
        tester.test_route_calculation()
        tester.test_trip_management()
        tester.test_fastag_payments()
        tester.test_nearby_locations()
        tester.test_safety_alerts()
        
        # Cleanup
        tester.cleanup_test_data()
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failed in tester.failed_tests:
            print(f"   - {failed['test']}: {failed.get('error', f'Expected {failed.get(\"expected\")}, got {failed.get(\"actual\")}')}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())