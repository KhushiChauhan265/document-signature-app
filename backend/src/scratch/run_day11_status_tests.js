const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('Starting Day 11 Signature Status & Reject Flow Verification Tests...\n');

  // 1. Generate unique email and credentials for owner
  const timestamp = Date.now();
  const ownerEmail = `owner_d11_${timestamp}@example.com`;
  const ownerPassword = 'password123';
  const ownerName = 'Document Owner';

  // Register owner
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

  // Create a second user (stranger)
  const strangerEmail = `stranger_d11_${timestamp}@example.com`;
  console.log('2. Registering stranger user...');
  const strangerRegRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Stranger Danger', email: strangerEmail, password: ownerPassword })
  });
  if (!strangerRegRes.ok) {
    throw new Error(`Failed to register stranger: ${await strangerRegRes.text()}`);
  }
  const strangerRegData = await strangerRegRes.json();
  const strangerToken = strangerRegData.token;

  // Create mock PDF buffer
  const mockPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources << >>\n/MediaBox [0 0 595.275 841.89]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n202\n%%EOF');

  // 3. Upload "many-people" document
  console.log('\n3. Uploading many-people document as owner...');
  const mpFormData = new FormData();
  mpFormData.append('pdf', new Blob([mockPdfBytes], { type: 'application/pdf' }), 'status_test_doc.pdf');
  mpFormData.append('signerType', 'many-people');

  const mpUploadRes = await fetch(`${BASE_URL}/docs/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: mpFormData
  });
  if (!mpUploadRes.ok) {
    throw new Error(`Failed to upload doc: ${await mpUploadRes.text()}`);
  }
  const mpUploadData = await mpUploadRes.json();
  const doc = mpUploadData.document;
  console.log(`   Uploaded doc ID: ${doc._id}`);

  // 4. Place 2 signature boxes
  console.log('\n4. Placing 2 signature boxes on document...');
  for (let i = 0; i < 2; i++) {
    const res = await fetch(`${BASE_URL}/signatures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ documentId: doc._id, x: 15 + i * 20, y: 45, page: 1 })
    });
    if (!res.ok) {
      throw new Error(`Failed to place signature box ${i+1}: ${await res.text()}`);
    }
  }
  console.log('   Signature boxes placed.');

  // 5. Share with two signers
  console.log('\n5. Sharing document with 2 external signers (signer1 & signer2)...');
  const shareRes = await fetch(`${BASE_URL}/docs/${doc._id}/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({ emails: ['signer1@gmail.com', 'signer2@gmail.com'] })
  });
  if (!shareRes.ok) {
    throw new Error(`Failed to share document: ${await shareRes.text()}`);
  }
  const shareData = await shareRes.json();
  console.log('   Invitations processed.');

  // Extract public links/tokens
  const signer1LinkObj = shareData.sent.find(s => s.email === 'signer1@gmail.com') || shareData.failed.find(s => s.email === 'signer1@gmail.com');
  const signer2LinkObj = shareData.sent.find(s => s.email === 'signer2@gmail.com') || shareData.failed.find(s => s.email === 'signer2@gmail.com');
  const token1 = new URL(signer1LinkObj.link).searchParams.get('token');
  const token2 = new URL(signer2LinkObj.link).searchParams.get('token');

  // 6. Signer 2 rejects the document
  console.log('\n6. Signer 2 rejects document with reason "Incorrect contract terms"...');
  const rejectRes = await fetch(`${BASE_URL}/docs/public/reject/${token2}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rejectReason: 'Incorrect contract terms' })
  });
  if (!rejectRes.ok) {
    throw new Error(`Failed to reject Signer 2: ${await rejectRes.text()}`);
  }
  const rejectData = await rejectRes.json();
  console.log(`   Signer 2 successfully rejected. Document status: ${rejectData.document.status} (Expected: rejected)`);
  if (rejectData.document.status !== 'rejected') {
    throw new Error('Document status should be rejected after a signer rejects');
  }
  if (rejectData.document.rejectReason !== 'Incorrect contract terms') {
    throw new Error('Document rejectReason was not saved correctly');
  }

  // 7. Try to sign or verify with token 1 (after document has been rejected)
  console.log('\n7. Signer 1 (who is pending) tries to verify (Document is rejected)...');
  const verifyRes1 = await fetch(`${BASE_URL}/docs/public/verify/${token1}`);
  console.log(`   Verification status: ${verifyRes1.status} (Expected: 400)`);
  if (verifyRes1.status !== 400) {
    throw new Error('Verification on rejected document should return 400 Bad Request');
  }
  const verifyText1 = await verifyRes1.json();
  console.log(`   Verification message: "${verifyText1.message}"`);

  // 8. Try to sign with token 1 (after document has been rejected)
  console.log('\n8. Signer 1 (who is pending) tries to sign (Document is rejected)...');
  const signRes1 = await fetch(`${BASE_URL}/docs/public/sign/${token1}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signerName: 'Alice Signer 1' })
  });
  console.log(`   Sign status: ${signRes1.status} (Expected: 400)`);
  if (signRes1.status !== 400) {
    throw new Error('Signing on rejected document should return 400 Bad Request');
  }
  const signText1 = await signRes1.json();
  console.log(`   Sign message: "${signText1.message}"`);

  // 9. Fetch audit logs as owner and verify 'document_rejected' exists
  console.log('\n9. Owner fetches audit logs...');
  const auditRes = await fetch(`${BASE_URL}/audit/${doc._id}`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  if (!auditRes.ok) {
    throw new Error(`Failed to fetch audit log: ${await auditRes.text()}`);
  }
  const logs = await auditRes.json();
  console.log(`   Found ${logs.length} log entries.`);
  console.log('   Log details:', logs.map(l => `${l.action} | signer: ${l.signerEmail} | metadata: ${JSON.stringify(l.metadata)}`));
  
  const rejectLog = logs.find(l => l.action === 'document_rejected');
  if (!rejectLog) {
    throw new Error('document_rejected audit log entry is missing');
  }
  if (rejectLog.metadata?.rejectReason !== 'Incorrect contract terms') {
    throw new Error('document_rejected audit log did not capture rejectReason correctly');
  }
  console.log('   Audit log successfully contains document_rejected with the rejectReason.');

  // 10. Fetch audit logs as stranger -> Expect 403 Forbidden
  console.log('\n10. Fetching audit logs as unauthorized stranger...');
  const auditStrangerRes = await fetch(`${BASE_URL}/audit/${doc._id}`, {
    headers: { 'Authorization': `Bearer ${strangerToken}` }
  });
  console.log(`    Response status: ${auditStrangerRes.status} (Expected: 403)`);
  if (auditStrangerRes.status !== 403) {
    throw new Error('Unauthorized access should be rejected with 403 Forbidden');
  }

  console.log('\n======================================================');
  console.log('ALL DAY 11 SIGNATURE STATUS WORKFLOW TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch(error => {
  console.error('\n❌ TEST RUN FAILED:', error.message);
  process.exit(1);
});
