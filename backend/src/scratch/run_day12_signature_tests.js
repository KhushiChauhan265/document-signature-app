const BASE_URL = 'http://localhost:5000/api';

// Simple 1x1 transparent PNG data URL for testing
const MOCK_PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('Starting Day 12 Signature Options Verification Tests...\n');

  const timestamp = Date.now();
  const ownerEmail = `owner_d12_${timestamp}@example.com`;
  const ownerPassword = 'password123';
  const ownerName = 'Document Owner';

  // 1. Register owner
  console.log('1. Registering document owner...');
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ownerName, email: ownerEmail, password: ownerPassword })
  });
  if (!regRes.ok) {
    throw new Error(`Failed to register owner: ${await regRes.text()}`);
  }
  const regData = await regRes.json();
  const ownerToken = regData.token;
  console.log(`   Owner registered successfully.`);

  // Create mock PDF buffer
  const mockPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources << >>\n/MediaBox [0 0 595.275 841.89]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n202\n%%EOF');

  // 2. Upload "only-you" document
  console.log('\n2. Uploading only-you document as owner...');
  const oyFormData = new FormData();
  oyFormData.append('pdf', new Blob([mockPdfBytes], { type: 'application/pdf' }), 'only_you_sig_test.pdf');
  oyFormData.append('signerType', 'only-you');

  const oyUploadRes = await fetch(`${BASE_URL}/docs/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: oyFormData
  });
  if (!oyUploadRes.ok) {
    throw new Error(`Failed to upload doc: ${await oyUploadRes.text()}`);
  }
  const oyUploadData = await oyUploadRes.json();
  const oyDoc = oyUploadData.document;
  console.log(`   Uploaded doc ID: ${oyDoc._id}`);

  // 3. Place signature box on "only-you" doc
  console.log('\n3. Placing signature box on only-you document...');
  const sigPlaceRes = await fetch(`${BASE_URL}/signatures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({ documentId: oyDoc._id, x: 20, y: 30, page: 1 })
  });
  if (!sigPlaceRes.ok) {
    throw new Error(`Failed to place signature: ${await sigPlaceRes.text()}`);
  }
  console.log('   Signature box placed.');

  // 4. Finalize "only-you" document with drawn/PNG signature
  console.log('\n4. Finalizing only-you document with DRAWN/PNG signature...');
  const finalizeRes = await fetch(`${BASE_URL}/docs/${oyDoc._id}/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      signatureMode: 'drawn',
      signatureData: MOCK_PNG_DATA
    })
  });
  if (!finalizeRes.ok) {
    throw new Error(`Failed to finalize: ${await finalizeRes.text()}`);
  }
  const finalizeData = await finalizeRes.json();
  console.log(`   Finalization response message: "${finalizeData.message}"`);
  console.log(`   Document status: ${finalizeData.document.status} (Expected: signed)`);
  console.log(`   Owner signature mode: ${finalizeData.document.ownerSignatureMode} (Expected: drawn)`);
  if (finalizeData.document.status !== 'signed' || finalizeData.document.ownerSignatureMode !== 'drawn') {
    throw new Error('Drawn owner finalize status/mode mismatch');
  }

  // 5. Upload "many-people" document
  console.log('\n5. Uploading many-people document as owner...');
  const mpFormData = new FormData();
  mpFormData.append('pdf', new Blob([mockPdfBytes], { type: 'application/pdf' }), 'many_people_sig_test.pdf');
  mpFormData.append('signerType', 'many-people');

  const mpUploadRes = await fetch(`${BASE_URL}/docs/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: mpFormData
  });
  if (!mpUploadRes.ok) {
    throw new Error(`Failed to upload many-people doc: ${await mpUploadRes.text()}`);
  }
  const mpUploadData = await mpUploadRes.json();
  const mpDoc = mpUploadData.document;
  console.log(`   Uploaded doc ID: ${mpDoc._id}`);

  // 6. Place signature box for external signer
  console.log('\n6. Placing signature box for signer1@example.com...');
  const sigPlaceRes2 = await fetch(`${BASE_URL}/signatures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({ documentId: mpDoc._id, x: 50, y: 50, page: 1, signerEmail: 'signer1@example.com' })
  });
  if (!sigPlaceRes2.ok) {
    throw new Error(`Failed to place signature: ${await sigPlaceRes2.text()}`);
  }
  console.log('   Signature box placed.');

  // 7. Invite signer1
  console.log('\n7. Sharing document with signer1@example.com...');
  const shareRes = await fetch(`${BASE_URL}/docs/${mpDoc._id}/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({ emails: ['signer1@example.com'] })
  });
  if (!shareRes.ok) {
    throw new Error(`Failed to share document: ${await shareRes.text()}`);
  }
  const shareData = await shareRes.json();
  const signerLinkObj = shareData.sent.find(s => s.email === 'signer1@example.com') || shareData.failed.find(s => s.email === 'signer1@example.com');
  const publicToken = new URL(signerLinkObj.link).searchParams.get('token');
  console.log(`   Extracted signing token: ${publicToken}`);

  // 8. Sign publicly using handwritten font style
  console.log('\n8. Signer1 signs with HANDWRITTEN signature mode...');
  const signRes = await fetch(`${BASE_URL}/docs/public/sign/${publicToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signerName: 'Jane Signer',
      signatureMode: 'handwritten',
      signatureFont: 'Caveat',
      signatureData: MOCK_PNG_DATA
    })
  });
  if (!signRes.ok) {
    throw new Error(`Failed public signing: ${await signRes.text()}`);
  }
  const signData = await signRes.json();
  console.log(`   Signing response: "${signData.message}"`);
  
  // Verify document status in DB
  const verifyDocRes = await fetch(`${BASE_URL}/docs/${mpDoc._id}`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const verifyDocData = await verifyDocRes.json();
  const targetSigner = verifyDocData.signers.find(s => s.email === 'signer1@example.com');
  console.log(`   Final Document Status: ${verifyDocData.status} (Expected: signed)`);
  console.log(`   Signer status: ${targetSigner.status} (Expected: signed)`);
  console.log(`   Signer signature mode: ${targetSigner.signatureMode} (Expected: handwritten)`);
  console.log(`   Signer signature font: ${targetSigner.signatureFont} (Expected: Caveat)`);
  
  if (verifyDocData.status !== 'signed' || targetSigner.signatureMode !== 'handwritten' || targetSigner.signatureFont !== 'Caveat') {
    throw new Error('Public signer signature modes/fonts not stored correctly');
  }

  // 9. Fetch audit logs and verify correct logs exist
  console.log('\n9. Checking audit logs for signature mode logs...');
  const auditRes = await fetch(`${BASE_URL}/audit/${mpDoc._id}`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const auditLogs = await auditRes.json();
  console.log('   Audit Logs Actions:');
  auditLogs.forEach(l => console.log(`   - ${l.action} (signer: ${l.signerEmail}, mode: ${l.metadata?.signatureMode || 'N/A'})`));
  
  const signLog = auditLogs.find(l => l.action === 'document_signed');
  if (!signLog) {
    throw new Error('document_signed audit log is missing');
  }
  if (signLog.metadata?.signatureMode !== 'handwritten') {
    throw new Error('document_signed audit log metadata did not capture signatureMode');
  }

  console.log('\n======================================================');
  console.log('ALL DAY 12 MULTI-SIGNATURE WORKFLOW TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch(error => {
  console.error('\n❌ TEST RUN FAILED:', error.message);
  process.exit(1);
});
