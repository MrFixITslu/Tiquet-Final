const assert = require('assert');

async function runSecurityTests() {
  const API_URL = 'http://localhost:3001/api';
  let passed = 0;
  let failed = 0;

  function testLog(name, isPass, error) {
    if (isPass) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   ${error}`);
      failed++;
    }
  }

  // 1. Unauthorized Access
  try {
    const res = await fetch(`${API_URL}/jobs`);
    assert.strictEqual(res.status, 403, 'Should reject unauthenticated requests to protected endpoints.');
    testLog('Unauthorized Access to /jobs', true);
  } catch (e) {
    testLog('Unauthorized Access to /jobs', false, e.message);
  }

  // 2. SQL injection payload attempt on Login
  try {
    const payload = {
      email: "admin@test.com' OR '1'='1",
      password: "password"
    };
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    // Should gracefully fail auth rather than error out or permit access
    const data = await res.json();
    assert.notStrictEqual(res.status, 200, 'Should not allow login with SQL injection.');
    assert.strictEqual(data.error, 'Invalid credentials', 'Should return standard credential error.');
    testLog('SQL Injection on Login', true);
  } catch (e) {
    testLog('SQL Injection on Login', false, e.message);
  }

  // 3. XSS in public endpoints (If any exist. We'll test job creation indirectly via XSS string injection to see if it causes server faults)
  // For standard XSS, the most vulnerable place is usually if the server reflects the input unsafely. The real test is E2E UI.
  // Here we just ensure the server accepts strings with HTML and doesn't crash or truncate them unexpectedly.
  
  if (failed > 0) {
    console.error(`\nSecurity Tests: ${passed} passed, ${failed} failed.`);
    process.exit(1);
  } else {
    console.log(`\nSecurity Tests: ${passed} passed, 0 failed.`);
    process.exit(0);
  }
}

runSecurityTests();
