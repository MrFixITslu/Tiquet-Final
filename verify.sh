#!/bin/bash
set -e

SUFFIX=$(date +%s)
echo "Registering Account A..."
RES_A=$(curl -s -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"companyName\": \"Acme Corp\", \"name\": \"Alice admin\", \"email\": \"alice${SUFFIX}@acme.com\", \"password\": \"password123\"}")
TOKEN_A=$(echo $RES_A | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

echo "Registering Account B..."
RES_B=$(curl -s -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"companyName\": \"Beta LLC\", \"name\": \"Bob admin\", \"email\": \"bob${SUFFIX}@beta.com\", \"password\": \"password123\"}")
TOKEN_B=$(echo $RES_B | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

echo "Creating Job in Account A..."
JOB_A=$(curl -s -X POST http://localhost:3001/api/jobs -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_A" -d "{\"title\": \"Acme Project ${SUFFIX}\", \"client\": \"Client A\", \"description\": \"Test\", \"status\": \"request\", \"priority\": \"medium\", \"createdAt\": \"2024-01-01T00:00:00Z\"}")

echo "Fetching Jobs for Account B..."
JOBS_B=$(curl -s http://localhost:3001/api/jobs -H "Authorization: Bearer $TOKEN_B")

if echo "$JOBS_B" | grep -q "Acme Project 1"; then
  echo "TEST FAILED: Account B can see Account A's job!"
  exit 1
else
  echo "TEST PASSED: Isolation confirmed. Account B cannot see Acouunt A's job."
fi

# Quote Approval Test
echo "Setting Job A to estimation..."
JOB_ID=$(echo $JOB_A | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
SECURE_TOKEN=$(echo $JOB_A | grep -o '"secureToken":"[^"]*' | grep -o '[^"]*$')
curl -s -X PUT http://localhost:3001/api/jobs/$JOB_ID -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_A" -d "{\"title\": \"Acme Project ${SUFFIX}\", \"status\": \"estimation\", \"amount\": 1000, \"priority\": \"medium\", \"client\": \"Client A\", \"description\": \"Test\"}" > /dev/null

echo "Simulating client portal loading job A..."
PORTAL_RES=$(curl -s http://localhost:3001/api/portal/$SECURE_TOKEN)
if echo "$PORTAL_RES" | grep -q "Acme Project ${SUFFIX}"; then
    echo "TEST PASSED: Client portal accessible."
else
    echo "TEST FAILED: Client portal failed to load."
    exit 1
fi

echo "Client approving quote..."
curl -s -X POST http://localhost:3001/api/portal/$SECURE_TOKEN/approve-quote > /dev/null

echo "Verifying quote is approved..."
APPROVED_JOB=$(curl -s http://localhost:3001/api/jobs -H "Authorization: Bearer $TOKEN_A")
if echo "$APPROVED_JOB" | grep -q '"quoteApproved":1'; then
    echo "TEST PASSED: Quote was approved."
else
    echo "TEST FAILED: Quote was not approved."
    exit 1
fi

echo "All backend tests passed!"
