const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('Starting Day 10 Audit Trail Verification Tests...\n');

  // 1. Generate unique email and credentials for owner
  const timestamp = Date.now();
  const ownerEmail = `owner_${timestamp}@example.com`;
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
  console.log(`   Owner registered successfully. Token length: ${ownerToken.length}`);

  // Create a second user (unauthorized user)
  const strangerEmail = `stranger_${timestamp}@example.com`;
  console.log('2. Registering unauthorized stranger user...');
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

  // Create mock PDF buffer (simple empty PDF bytes)
  const mockPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources << >>\n/MediaBox [0 0 595.275 841.89]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n202\n%%EOF');

  // 3. Upload "many-people" document
  console.log('\n3. Uploading many-people document as owner...');
  const mpFormData = new FormData();
  mpFormData.append('pdf', new Blob([mockPdfBytes], { type: 'application/pdf' }), 'audit_test_doc.pdf');
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
  console.log('\n5. Sharing document with 2 external signers...');
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

  // 6. Fetch audit log and verify 'invite_email_sent' events exist
  console.log('\n6. Fetching audit logs as owner (Expecting invite_email_sent)...');
  const auditRes1 = await fetch(`${BASE_URL}/audit/${doc._id}`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  if (!auditRes1.ok) {
    throw new Error(`Failed to fetch audit log: ${await auditRes1.text()}`);
  }
  const logs1 = await auditRes1.json();
  console.log(`   Found ${logs1.length} log entries.`);
  console.log('   Log details:', logs1.map(l => `${l.action} | signer: ${l.signerEmail} | IP: ${l.ipAddress}`));
  
  const inviteLogs = logs1.filter(l => l.action === 'invite_email_sent');
  if (inviteLogs.length !== 2) {
    throw new Error(`Expected exactly 2 invite_email_sent logs, found ${inviteLogs.length}`);
  }

  // 7. Verify token 1 -> logs signature_link_opened
  console.log('\n7. Verifying token 1 via public gateway...');
  const verifyRes = await fetch(`${BASE_URL}/docs/public/verify/${token1}`);
  if (!verifyRes.ok) {
    throw new Error(`Failed to verify token 1: ${await verifyRes.text()}`);
  }
  console.log('   Verification successful.');

  // Check audit log for 'signature_link_opened'
  const auditRes2 = await fetch(`${BASE_URL}/audit/${doc._id}`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const logs2 = await auditRes2.json();
  const verifyLog = logs2.find(l => l.action === 'signature_link_opened');
  if (!verifyLog || verifyLog.signerEmail !== 'signer1@gmail.com') {
    throw new Error('signature_link_opened audit entry missing or incorrect');
  }
  console.log(`   Audit log updated successfully with signature_link_opened. IP registered: ${verifyLog.ipAddress}`);

  // 8. Stream PDF -> logs document_viewed
  console.log('\n8. Streaming PDF via public view token...');
  const viewRes = await fetch(`${BASE_URL}/docs/public/view/${token1}`);
  if (!viewRes.ok) {
    throw new Error(`Failed to view PDF: ${await viewRes.text()}`);
  }
  console.log('   PDF stream received.');

  // Check audit log for 'document_viewed'
  const auditRes3 = await fetch(`${BASE_URL}/audit/${doc._id}`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const logs3 = await auditRes3.json();
  const viewLog = logs3.find(l => l.action === 'document_viewed');
  if (!viewLog || viewLog.signerEmail !== 'signer1@gmail.com') {
    throw new Error('document_viewed audit entry missing or incorrect');
  }
  console.log(`   Audit log updated successfully with document_viewed. IP registered: ${viewLog.ipAddress}`);

  // 9. Sign through token 1 -> logs document_signed
  console.log('\n9. Submitting signature for Signer 1...');
  const signRes1 = await fetch(`${BASE_URL}/docs/public/sign/${token1}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signerName: 'Alice Signer 1' })
  });
  if (!signRes1.ok) {
    throw new Error(`Failed to sign Signer 1: ${await signRes1.text()}`);
  }
  console.log('   Signer 1 successfully signed.');

  // Check audit log for first 'document_signed'
  const auditRes4 = await fetch(`${BASE_URL}/audit/${doc._id}`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const logs4 = await auditRes4.json();
  const signLog1 = logs4.find(l => l.action === 'document_signed' && l.signerEmail === 'signer1@gmail.com');
  if (!signLog1 || signLog1.signerName !== 'Alice Signer 1') {
    throw new Error('document_signed audit entry missing or incorrect for Signer 1');
  }
  console.log(`   Audit log updated successfully with document_signed (Signer 1).`);

  // 10. Fetch audit logs as stranger -> Expect 403 Forbidden
  console.log('\n10. Fetching audit logs as unauthorized stranger...');
  const auditStrangerRes = await fetch(`${BASE_URL}/audit/${doc._id}`, {
    headers: { 'Authorization': `Bearer ${strangerToken}` }
  });
  console.log(`    Response status: ${auditStrangerRes.status} (Expected: 403)`);
  if (auditStrangerRes.status !== 403) {
    throw new Error('Unauthorized access should be rejected with 403 Forbidden');
  }

  // 11. Fetch audit logs with invalid ID format -> Expect 400 Bad Request
  console.log('\n11. Fetching audit logs with invalid ID format...');
  const auditInvalidRes = await fetch(`${BASE_URL}/audit/invalid_id_format`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  console.log(`    Response status: ${auditInvalidRes.status} (Expected: 400)`);
  if (auditInvalidRes.status !== 400) {
    throw new Error('Invalid ID format should return 400 Bad Request');
  }

  console.log('\n=================================================');
  console.log('ALL DAY 10 AUDIT TRAIL TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================\n');
}

runTests().catch(error => {
  console.error('\n❌ TEST RUN FAILED:', error.message);
  process.exit(1);
});
