#!/usr/bin/env python3
"""
DevPrep India Backend API Tests
Tests all interview functionality including session creation, Q&A flow, and results
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

class DevPrepTester:
    def __init__(self, base_url: str = "https://devprep-india.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_data = {}
        self.tests_run = 0
        self.tests_passed = 0
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED {details}")
        else:
            print(f"❌ {test_name} - FAILED {details}")
        return success

    def api_request(self, method: str, endpoint: str, data: Optional[Dict] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make API request and validate response"""
        url = f"{self.api_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method {method}"}
            
            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
            
            if not success:
                response_data["status_code"] = response.status_code
                response_data["expected_status"] = expected_status
                
            return success, response_data
            
        except requests.exceptions.Timeout:
            return False, {"error": "Request timeout"}
        except Exception as e:
            return False, {"error": str(e)}

    def test_api_health(self):
        """Test basic API connectivity"""
        success, data = self.api_request("GET", "/", expected_status=200)
        return self.log_result("API Health Check", success, 
                              f"Message: {data.get('message', 'No message')}" if success else f"Error: {data}")

    def test_status_endpoints(self):
        """Test status endpoints"""
        # Test status creation
        test_data = {"client_name": f"test_client_{datetime.now().strftime('%H%M%S')}"}
        success, data = self.api_request("POST", "/status", data=test_data, expected_status=200)
        
        if not self.log_result("Status Creation", success, f"ID: {data.get('id', 'N/A')}" if success else f"Error: {data}"):
            return False
            
        # Test status retrieval
        success, data = self.api_request("GET", "/status", expected_status=200)
        return self.log_result("Status Retrieval", success, 
                              f"Found {len(data) if isinstance(data, list) else 0} records" if success else f"Error: {data}")

    def test_interview_start(self, role: str = "Frontend", experience: str = "Fresher") -> bool:
        """Test interview session creation"""
        request_data = {
            "role": role,
            "experience": experience
        }
        
        success, data = self.api_request("POST", "/interview/start", data=request_data, expected_status=200)
        
        if success:
            required_fields = ["session_id", "role", "experience", "first_question"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                success = False
                data = {"error": f"Missing fields: {missing_fields}"}
            else:
                self.session_data = {
                    "session_id": data["session_id"],
                    "role": data["role"],
                    "experience": data["experience"],
                    "current_question": data["first_question"]
                }
        
        return self.log_result("Interview Start", success, 
                              f"Session: {data.get('session_id', 'N/A')[:8]}..." if success else f"Error: {data}")

    def test_interview_answer_flow(self, num_questions: int = 5) -> bool:
        """Test complete Q&A flow for specified number of questions"""
        if not self.session_data.get("session_id"):
            return self.log_result("Answer Flow", False, "No active session")
        
        session_id = self.session_data["session_id"]
        
        for q_num in range(1, num_questions + 1):
            # Submit answer
            test_answer = f"This is my test answer for question {q_num}. I would implement this using modern best practices and ensure proper error handling."
            
            request_data = {
                "session_id": session_id,
                "answer": test_answer
            }
            
            success, data = self.api_request("POST", "/interview/answer", data=request_data, expected_status=200)
            
            if not success:
                return self.log_result(f"Answer Q{q_num}", False, f"Error: {data}")
            
            # Validate response structure
            required_fields = ["feedback", "is_complete", "current_question_number", "total_questions"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                return self.log_result(f"Answer Q{q_num}", False, f"Missing fields: {missing_fields}")
            
            # Check if this should be the last question
            is_last_question = q_num == num_questions
            is_complete = data.get("is_complete", False)
            
            if is_last_question and not is_complete:
                return self.log_result(f"Answer Q{q_num}", False, "Expected interview to be complete")
            elif not is_last_question and is_complete:
                return self.log_result(f"Answer Q{q_num}", False, "Interview completed too early")
            elif not is_last_question and not data.get("next_question"):
                return self.log_result(f"Answer Q{q_num}", False, "Missing next question")
            
            self.log_result(f"Answer Q{q_num}", True, 
                           f"Complete: {is_complete}, Question {data.get('current_question_number', 'N/A')}")
            
            # Add delay to allow AI processing time
            time.sleep(2)
        
        return True

    def test_interview_results(self) -> bool:
        """Test results retrieval"""
        if not self.session_data.get("session_id"):
            return self.log_result("Results Retrieval", False, "No active session")
        
        session_id = self.session_data["session_id"]
        success, data = self.api_request("GET", f"/interview/results/{session_id}", expected_status=200)
        
        if success:
            required_fields = ["session_id", "role", "experience", "overall_score", "questions", "summary"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                success = False
                data = {"error": f"Missing fields: {missing_fields}"}
            else:
                # Validate score is reasonable
                score = data.get("overall_score", 0)
                if not isinstance(score, int) or score < 0 or score > 10:
                    success = False
                    data = {"error": f"Invalid overall score: {score}"}
                elif len(data.get("questions", [])) != 5:
                    success = False
                    data = {"error": f"Expected 5 questions, got {len(data.get('questions', []))}"}
        
        return self.log_result("Results Retrieval", success, 
                              f"Score: {data.get('overall_score', 'N/A')}/10" if success else f"Error: {data}")

    def test_error_handling(self) -> bool:
        """Test error scenarios"""
        tests_passed = 0
        total_tests = 3
        
        # Test invalid session ID
        success, data = self.api_request("GET", "/interview/results/invalid-session-id", expected_status=404)
        if self.log_result("Invalid Session ID", success, "Correctly returned 404"):
            tests_passed += 1
        
        # Test missing fields in start interview
        success, data = self.api_request("POST", "/interview/start", data={}, expected_status=422)
        if self.log_result("Missing Start Data", success, "Correctly returned validation error"):
            tests_passed += 1
        
        # Test answer without session
        answer_data = {"session_id": "nonexistent", "answer": "test"}
        success, data = self.api_request("POST", "/interview/answer", data=answer_data, expected_status=404)
        if self.log_result("Answer Non-existent Session", success, "Correctly returned 404"):
            tests_passed += 1
            
        return tests_passed == total_tests

    def run_comprehensive_test(self):
        """Run full test suite"""
        print("🚀 Starting DevPrep India Backend Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("="*60)
        
        # Test sequence
        if not self.test_api_health():
            print("❌ API not accessible, stopping tests")
            return False
            
        if not self.test_status_endpoints():
            print("⚠️  Status endpoints failed, continuing with interview tests")
        
        # Test different role and experience combinations
        test_combinations = [
            ("Frontend", "Fresher"),
            ("Backend", "1-3 years"),
            ("Full Stack", "3+ years")
        ]
        
        successful_flows = 0
        
        for role, experience in test_combinations:
            print(f"\n🧪 Testing {role} - {experience}")
            print("-" * 40)
            
            if (self.test_interview_start(role, experience) and
                self.test_interview_answer_flow() and
                self.test_interview_results()):
                successful_flows += 1
                print(f"✅ Complete flow for {role} - {experience} successful")
            else:
                print(f"❌ Flow failed for {role} - {experience}")
            
            # Reset session data for next test
            self.session_data = {}
            print()
        
        # Test error handling
        print("🔍 Testing Error Scenarios")
        print("-" * 40)
        error_tests_passed = self.test_error_handling()
        
        # Final results
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        print(f"Complete Interview Flows: {successful_flows}/{len(test_combinations)}")
        
        if successful_flows >= 2 and error_tests_passed:
            print("🎉 Overall: PASSED - Core functionality working")
            return True
        else:
            print("💥 Overall: FAILED - Critical issues found")
            return False

def main():
    """Main test execution"""
    tester = DevPrepTester()
    success = tester.run_comprehensive_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())