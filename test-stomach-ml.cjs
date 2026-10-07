/**
 * Automated end-to-end verification of the Stomach Health ML Assistant
 */

const BASE_URL = 'http://127.0.0.1:8000';

async function testMLService() {
  console.log('==================================================');
  console.log('STOMACH HEALTH ML FEATURE VERIFICATION');
  console.log('==================================================\n');

  // Test 1: ML Health Check
  console.log('--- TEST 1: ML Health Endpoint ---');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log('Health Response:', JSON.stringify(healthData, null, 2));
  if (healthData.status !== 'healthy') throw new Error('ML health check failed');

  // Test 2: Standard Digestive Prediction (GERD)
  console.log('\n--- TEST 2: Prediction for GERD Symptoms ---');
  const gerdRes = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symptoms: ['heartburn', 'acid_reflux', 'indigestion'],
      duration: '1-2 days',
      severity: 'mild'
    })
  });
  const gerdData = await gerdRes.json();
  console.log('GERD Prediction:', gerdData.prediction, `(Confidence: ${(gerdData.confidence * 100).toFixed(1)}%)`);
  if (gerdData.prediction !== 'GERD') throw new Error('Expected GERD prediction');

  // Test 3: Gastroenteritis Prediction
  console.log('\n--- TEST 3: Prediction for Gastroenteritis Symptoms ---');
  const gastroRes = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symptoms: ['diarrhea', 'vomiting', 'nausea', 'cramping'],
      duration: '2 days',
      severity: 'moderate'
    })
  });
  const gastroData = await gastroRes.json();
  console.log('Gastroenteritis Prediction:', gastroData.prediction, `(Confidence: ${(gastroData.confidence * 100).toFixed(1)}%)`);
  if (gastroData.prediction !== 'Gastroenteritis') throw new Error('Expected Gastroenteritis prediction');

  // Test 4: Constipation Prediction
  console.log('\n--- TEST 4: Prediction for Constipation Symptoms ---');
  const constRes = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symptoms: ['constipation', 'hard_stool', 'bloating'],
      duration: '4 days',
      severity: 'mild'
    })
  });
  const constData = await constRes.json();
  console.log('Constipation Prediction:', constData.prediction, `(Confidence: ${(constData.confidence * 100).toFixed(1)}%)`);
  if (constData.prediction !== 'Constipation') throw new Error('Expected Constipation prediction');

  console.log('\n==================================================');
  console.log('✓ ALL ML ASSISTANT VERIFICATION CHECKS PASSED!');
  console.log('==================================================');
}

testMLService().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
