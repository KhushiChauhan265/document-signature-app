import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';

// Configure the pdfjs worker to resolve react-pdf dependency
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function App() {
  // Navigation State: 'login', 'register', or 'dashboard'
  const [view, setView] = useState('login');
  
  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // User Session State
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('docSignToken') || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Day 3 File Upload States
  const [selectedFile, setSelectedFile] = useState(null);
  const [signerType, setSignerType] = useState('only-you');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Day 4 Document List States
  const [documents, setDocuments] = useState([]);
  
  // Day 5 & 6 PDF Editor & Drag & Drop Signature States
  const [activeDocumentId, setActiveDocumentId] = useState('');
  const [previewFileUrl, setPreviewFileUrl] = useState('');
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [signatures, setSignatures] = useState([]);

  const currentDoc = documents.find(d => d._id === activeDocumentId);
  const isSigned = currentDoc?.status === 'signed';

  // Day 9 Public Sharing & Sign States
  const [publicToken, setPublicToken] = useState('');
  const [publicDoc, setPublicDoc] = useState(null);
  const [publicSignatures, setPublicSignatures] = useState([]);
  const [signerName, setSignerName] = useState('');
  const [isSigningPublic, setIsSigningPublic] = useState(false);
  const [publicSignError, setPublicSignError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectingPublic, setIsRejectingPublic] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  
  // Dashboard Share Modal States
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState('');
  const [shareEmails, setShareEmails] = useState('');
  const [shareResults, setShareResults] = useState(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareError, setShareError] = useState('');

  // Check for public signing token on mount or auto-login if token exists
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setPublicToken(tokenParam);
      setView('public-sign');
      fetchPublicDocument(tokenParam);
    } else if (token) {
      setView('dashboard');
      fetchUserProfile(token);
      fetchDocuments(token);
    }
  }, [token]);

  // Fetch public document details using the shared link token
  const fetchPublicDocument = async (tokenParam) => {
    setPublicSignError('');
    try {
      const response = await axios.get(`http://localhost:5000/api/docs/public/verify/${tokenParam}`);
      setPublicDoc(response.data.document);
      setPublicSignatures(response.data.signatures);
      setPreviewFileUrl(`http://localhost:5000/api/docs/public/view/${tokenParam}`);
      setPageNumber(1);
    } catch (error) {
      console.error('Failed to verify public signing link:', error);
      const msg = error.response?.data?.message || 'Invalid or expired signing link.';
      setPublicSignError(msg);
      setView('public-error');
    }
  };

  // Submit external signer name and complete finalization
  const handlePublicSign = async (e) => {
    e.preventDefault();
    if (!signerName.trim()) {
      alert('Please enter your name to sign.');
      return;
    }

    setIsSigningPublic(true);
    setPublicSignError('');
    try {
      await axios.post(`http://localhost:5000/api/docs/public/sign/${publicToken}`, {
        signerName
      });
      setView('public-success');
    } catch (error) {
      console.error('Public signing failed:', error);
      const msg = error.response?.data?.message || 'Failed to complete signing.';
      alert(msg);
    } finally {
      setIsSigningPublic(false);
    }
  };

  // Submit external signer rejection with a reason
  const handlePublicReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert('Please enter a reason for rejecting the document.');
      return;
    }

    setIsRejectingPublic(true);
    try {
      await axios.post(`http://localhost:5000/api/docs/public/reject/${publicToken}`, {
        rejectReason
      });
      setView('public-rejected');
    } catch (error) {
      console.error('Public rejection failed:', error);
      const msg = error.response?.data?.message || 'Failed to reject document.';
      alert(msg);
    } finally {
      setIsRejectingPublic(false);
    }
  };

  // Generate public signing link (called by owner)
  const handleShareDocument = async (e) => {
    e.preventDefault();
    const emailsArray = shareEmails
      .split(/[,\n;]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emailsArray.length === 0) {
      setShareError('Please enter at least one valid email address.');
      return;
    }

    setIsGeneratingLink(true);
    setShareError('');
    setShareResults(null);

    try {
      const response = await axios.post(`http://localhost:5000/api/docs/${shareDocId}/share`, {
        emails: emailsArray
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setShareResults({
        sent: response.data.sent || [],
        failed: response.data.failed || [],
        skipped: response.data.skipped || []
      });
      setShareEmails('');
      // Refresh documents list to reflect updated sharing status if needed
      fetchDocuments(token);
    } catch (error) {
      console.error('Failed to generate sharing link:', error);
      const msg = error.response?.data?.message || 'Failed to generate sharing link.';
      setShareError(msg);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Fetch user profile from backend using JWT
  const fetchUserProfile = async (authToken) => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      setUser(response.data);
      setErrorMessage('');
    } catch (error) {
      console.error('Session fetch failed:', error);
      handleLogout();
    }
  };

  // Fetch all documents uploaded by this user
  const fetchDocuments = async (authToken) => {
    try {
      const response = await axios.get('http://localhost:5000/api/docs/', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents list:', error.message);
    }
  };

  // Fetch saved signature positions for a document
  const fetchSignatures = async (docId, authToken) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/signatures/${docId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      setSignatures(response.data);
    } catch (error) {
      console.error('Error fetching signatures:', error.message);
    }
  };

  // Download finalized signed PDF securely
  const handleDownloadSigned = async (docId, fileName) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/docs/${docId}/download-signed`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const signedName = fileName.replace('.pdf', '') + '_signed.pdf';
      link.setAttribute('download', signedName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download signed PDF.');
    }
  };

  // Finalize document (render signature boxes using PDF-Lib on backend)
  const handleFinalizeDocument = async () => {
    if (!activeDocumentId) return;
    try {
      const response = await axios.post(`http://localhost:5000/api/docs/${activeDocumentId}/finalize`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Refresh documents list
      await fetchDocuments(token);
      
      // Load the finalized signed PDF in preview
      const downloadResponse = await axios.get(`http://localhost:5000/api/docs/${activeDocumentId}/download-signed`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      });
      
      const blobUrl = URL.createObjectURL(new Blob([downloadResponse.data]));
      setPreviewFileUrl(blobUrl);
      setSignatures([]); // Clear coordinates overlay since signature is now baked into the PDF
      alert(response.data.message || 'Document finalized and signed successfully!');
    } catch (error) {
      console.error('Finalize failed:', error);
      const msg = error.response && error.response.data && error.response.data.message
        ? error.response.data.message
        : 'Failed to finalize document. Make sure you placed at least one signature box.';
      alert(msg);
    }
  };

  // View finalized signed PDF in the preview modal
  const handleViewSignedDocument = async (doc) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/docs/${doc._id}/download-signed`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      });
      const blobUrl = URL.createObjectURL(new Blob([response.data]));
      setPreviewFileUrl(blobUrl);
      setActiveDocumentId(doc._id);
      setSignatures([]); // No overlays for finalized documents since it's already embedded in the PDF
      setPageNumber(1);
    } catch (error) {
      console.error('Failed to load signed document preview:', error);
      alert('Failed to load signed document preview.');
    }
  };

  // Submit: Register User
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        name: regName,
        email: regEmail,
        password: regPassword
      });

      const userToken = response.data.token;
      
      localStorage.setItem('docSignToken', userToken);
      setToken(userToken);
      setUser(response.data);
      setSuccessMessage('Account created successfully!');
      
      setRegName('');
      setRegEmail('');
      setRegPassword('');
    } catch (error) {
      const msg = error.response && error.response.data && error.response.data.message
        ? error.response.data.message
        : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    }
  };

  // Submit: Log In User
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: loginEmail,
        password: loginPassword
      });

      const userToken = response.data.token;

      localStorage.setItem('docSignToken', userToken);
      setToken(userToken);
      setUser(response.data);
      setSuccessMessage('Logged in successfully!');

      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      const msg = error.response && error.response.data && error.response.data.message
        ? error.response.data.message
        : 'Login failed. Invalid email or password.';
      setErrorMessage(msg);
    }
  };

  // File Selector Change Handler
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadError('');
      setUploadSuccess('');
    }
  };

  // Submit: Upload Document API call
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setUploadError('Please select a PDF document to upload.');
      return;
    }

    setUploadError('');
    setUploadSuccess('');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('pdf', selectedFile);
    formData.append('signerType', signerType);

    try {
      const response = await axios.post('http://localhost:5000/api/docs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      
      setUploadSuccess(`Document "${response.data.document.fileName}" uploaded successfully!`);
      setSelectedFile(null);
      e.target.reset();
      
      fetchDocuments(token);
    } catch (error) {
      console.error('Upload request failed:', error);
      const msg = error.response && error.response.data && error.response.data.message
        ? error.response.data.message
        : 'Upload failed. Only PDF files up to 10MB are accepted.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // PDF page load callback
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  // HTML5 Drag Drop Handler: Drop element onto PDF page canvas
  const handlePageDrop = async (e) => {
    e.preventDefault();
    if (!activeDocumentId || isSigned) return;

    // Get the page bounding box
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate cursor drop coordinates relative to container
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert pixels to relative percentages (0 to 100)
    const xPercent = (clientX / rect.width) * 100;
    const yPercent = (clientY / rect.height) * 100;

    // Read the drag payload content
    const dragData = e.dataTransfer.getData('text/plain');

    if (dragData === 'new-signature') {
      // 1. User dropped a NEW signature field from the sidebar palette
      try {
        const response = await axios.post('http://localhost:5000/api/signatures', {
          documentId: activeDocumentId,
          x: parseFloat(xPercent.toFixed(2)),
          y: parseFloat(yPercent.toFixed(2)),
          page: pageNumber
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        // Add to local state list to render instantly
        setSignatures(prev => [...prev, response.data.signature]);
      } catch (error) {
        console.error('Error creating signature position:', error);
        alert('Could not place signature box. Verify you own this document.');
      }
    } else if (dragData.startsWith('move-signature-')) {
      // 2. User dragged and dropped an EXISTING signature box to reposition it
      const signatureId = dragData.split('-')[2];

      try {
        const response = await axios.put(`http://localhost:5000/api/signatures/${signatureId}`, {
          x: parseFloat(xPercent.toFixed(2)),
          y: parseFloat(yPercent.toFixed(2)),
          page: pageNumber
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        // Update coordinate details in local React state
        setSignatures(prev => prev.map(sig => sig._id === signatureId ? response.data.signature : sig));
      } catch (error) {
        console.error('Error updating signature position:', error);
        alert('Failed to update signature box position.');
      }
    }
  };

  // Helper: Format file bytes size to readable KB/MB
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('docSignToken');
    setToken('');
    setUser(null);
    setDocuments([]);
    setSignatures([]);
    setActiveDocumentId('');
    setSuccessMessage('');
    setErrorMessage('');
    setUploadError('');
    setUploadSuccess('');
    setSelectedFile(null);
    setPreviewFileUrl('');
    setView('login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* View: LOGGED OUT (Login/Register Forms) */}
      {(view === 'login' || view === 'register') && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Document Signature App</h1>
              <p className="text-xs text-slate-400 mt-1">Access Gate</p>
            </div>

            {/* Error & Success Messages */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl p-3.5 mb-5 font-medium">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl p-3.5 mb-5 font-medium">
                {successMessage}
              </div>
            )}

            {/* Login Form */}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email Address</label>
                  <input 
                    type="email" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@email.com" 
                    required
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-teal-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password" 
                    required
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-teal-500 bg-slate-50/50"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-2.5 font-bold text-sm transition mt-2 cursor-pointer"
                >
                  Log In
                </button>

                <p className="text-center text-xs text-slate-500 mt-2">
                  Don't have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => { setView('register'); setErrorMessage(''); setSuccessMessage(''); }}
                    className="text-teal-600 hover:text-teal-700 font-semibold underline"
                  >
                    Register
                  </button>
                </p>
              </form>
            )}

            {/* Register Form */}
            {view === 'register' && (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Full Name</label>
                  <input 
                    type="text" 
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Enter your name" 
                    required
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-teal-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email Address</label>
                  <input 
                    type="email" 
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@email.com" 
                    required
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-teal-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Password (Min 6 chars)</label>
                  <input 
                    type="password" 
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create a password" 
                    required
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-teal-500 bg-slate-50/50"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-2.5 font-bold text-sm transition mt-2 cursor-pointer"
                >
                  Create Account
                </button>

                <p className="text-center text-xs text-slate-500 mt-2">
                  Already have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => { setView('login'); setErrorMessage(''); setSuccessMessage(''); }}
                    className="text-teal-600 hover:text-teal-700 font-semibold underline"
                  >
                    Log In
                  </button>
                </p>
              </form>
            )}

          </div>
        </div>
      )}

      {/* View: LOGGED IN (Dashboard Shell) */}
      {view === 'dashboard' && (
        <div className="flex-1 flex flex-col">
          
          {/* Dashboard Header Navbar */}
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shadow-slate-100/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                D
              </div>
              <span className="text-md font-bold tracking-tight text-slate-900">
                Document Signature App
              </span>
            </div>
            
            <button 
              onClick={handleLogout}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Sign Out
            </button>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 max-w-4xl w-full mx-auto p-6 lg:p-8 flex flex-col gap-6">
            
            {/* Welcome banner */}
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Welcome back, {user ? user.name : 'User'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Account Status: Active &bull; You are securely logged in.
              </p>
            </div>

            {/* Document Upload Card Container */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-800">Upload PDF for Signing</h3>
              
              {/* Form notifications */}
              {uploadError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl p-3">
                  ⚠️ {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl p-3">
                  ✓ {uploadSuccess}
                </div>
              )}

              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                
                {/* File Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Select PDF File</label>
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={handleFileChange}
                    required
                    className="text-xs text-slate-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 border border-slate-200 rounded-xl p-2 bg-slate-50/50 focus:outline-none"
                  />
                </div>

                {/* Signer Choice Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Who needs to sign this document?</label>
                  <select 
                    value={signerType}
                    onChange={(e) => setSignerType(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 bg-slate-50/50"
                  >
                    <option value="only-you">Only You (Sign it yourself)</option>
                    <option value="many-people">Many People (Invite others by email)</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  disabled={isUploading}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl py-2 font-bold text-xs transition cursor-pointer self-start px-5 shadow-sm"
                >
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </button>

              </form>
            </div>

            {/* Document Listing Workspace */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-800">Workspace Documents</h3>

              {documents.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center text-center p-8">
                  <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">No documents in this workspace</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                    Upload a PDF document above to get started with your digital signature workspace.
                  </p>
                </div>
              ) : (
                /* Document Table List */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-2">Document Name</th>
                        <th className="py-3 px-2">Size</th>
                        <th className="py-3 px-2">Date Added</th>
                        <th className="py-3 px-2">Signing Flow</th>
                        <th className="py-3 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {documents.map((doc) => (
                        <tr key={doc._id} className="hover:bg-slate-50/50 transition duration-150">
                          <td className="py-3.5 px-2 font-medium text-slate-900 max-w-[200px] truncate" title={doc.fileName}>
                            {doc.fileName}
                          </td>
                          <td className="py-3.5 px-2 text-slate-500">
                            {formatBytes(doc.fileSize)}
                          </td>
                          <td className="py-3.5 px-2 text-slate-500">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-2">
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {doc.signerType === 'only-you' ? 'Only You' : 'Many People'}
                            </span>
                            {doc.status === 'signed' ? (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ml-1.5">
                                Signed
                              </span>
                            ) : doc.status === 'rejected' ? (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 ml-1.5">
                                Rejected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 ml-1.5">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 text-right">
                            {doc.status === 'signed' ? (
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleViewSignedDocument(doc)}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                >
                                  View Document
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadSigned(doc._id, doc.fileName)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                >
                                  Download Signed
                                </button>
                              </div>
                            ) : doc.status === 'rejected' ? (
                              <div className="text-[10px] text-rose-600 font-semibold italic max-w-[200px] truncate ml-auto" title={doc.rejectReason}>
                                Reason: {doc.rejectReason || 'No reason specified'}
                              </div>
                            ) : (
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewFileUrl(`http://localhost:5000/uploads/${doc.filePath}`);
                                    setActiveDocumentId(doc._id);
                                    fetchSignatures(doc._id, token);
                                    setPageNumber(1);
                                  }}
                                  className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                >
                                  Open Editor
                                </button>
                                {doc.signerType === 'many-people' && doc.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShareDocId(doc._id);
                                      setIsShareModalOpen(true);
                                      setShareEmails('');
                                      setShareResults(null);
                                      setShareError('');
                                    }}
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                  >
                                    Invite Signer
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </main>

          {/* PDF Drag & Drop Editor Modal */}
          {previewFileUrl && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl flex flex-col shadow-xl my-8">
                
                {/* Modal Header */}
                <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {isSigned ? 'PDF Document Viewer (Signed)' : 'PDF Document Editor'}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isSigned ? 'Viewing finalized signed PDF document.' : 'Drag fields from the sidebar and drop them on the document pages.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setPreviewFileUrl(''); setActiveDocumentId(''); setSignatures([]); }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    Close Editor
                  </button>
                </div>

                {/* Editor Content Area (Split View) */}
                <div className="flex flex-1 min-h-[450px]">
                  
                  {/* Left Column: Draggable Fields Palette */}
                  <div className="w-56 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Signature Tools</span>
                    
                    {isSigned ? (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-emerald-800 text-xs font-medium flex flex-col gap-2">
                        <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                          ✓ Document Signed
                        </div>
                        <p className="leading-relaxed text-[11px] text-emerald-700">
                          This document has been finalized and signed. No more signature fields can be placed.
                        </p>
                        <button
                          onClick={() => handleDownloadSigned(activeDocumentId, currentDoc?.fileName || 'document.pdf')}
                          className="mt-2 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition cursor-pointer text-center"
                        >
                          Download Signed PDF
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Draggable Template Block */}
                        <div
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', 'new-signature');
                          }}
                          className="border border-dashed border-teal-400 bg-teal-50/50 hover:bg-teal-50 text-teal-700 p-4 rounded-xl flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing shadow-sm transition duration-150 select-none group"
                        >
                          <svg className="w-6 h-6 mb-2 text-teal-600 group-hover:scale-105 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <span className="text-xs font-bold">Signature Box</span>
                          <span className="text-[9px] text-slate-400 mt-1">Drag and drop on page</span>
                        </div>

                        <div className="mt-auto text-[9px] text-slate-400 bg-white border border-slate-200/60 p-3 rounded-lg leading-relaxed">
                          💡 **Tip**: Drop a box on the PDF. You can drag placed boxes to reposition them anywhere on the page.
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Column: PDF Viewer Drop Target */}
                  <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-100/30 overflow-x-auto">
                    
                    {/* Bounding box wrapper holding both canvas and absolute overlay elements */}
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handlePageDrop}
                      className="relative border border-slate-300 shadow-md select-none"
                    >
                      <PDFDocument
                        file={previewFileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="text-xs text-slate-500 font-medium">Loading document...</div>}
                        error={<div className="text-xs text-rose-500 font-medium">Failed to load PDF preview.</div>}
                      >
                        <PDFPage 
                          pageNumber={pageNumber} 
                          renderTextLayer={false} 
                          renderAnnotationLayer={false}
                          className="max-w-full"
                        />
                      </PDFDocument>

                      {/* Render absolute overlays of signature positions */}
                      {!isSigned && signatures
                        .filter(sig => sig.page === pageNumber)
                        .map((sig, idx) => (
                          <div
                            key={sig._id || idx}
                            draggable="true"
                            onDragStart={(e) => {
                              // Store the ID of the box we are moving
                              e.dataTransfer.setData('text/plain', `move-signature-${sig._id}`);
                            }}
                            style={{
                              left: `${sig.x}%`,
                              top: `${sig.y}%`,
                              transform: 'translate(-50%, -50%)' // Centers the box on cursor drop coordinates
                            }}
                            className="absolute bg-teal-500/20 border border-teal-500 text-teal-700 text-[9px] font-bold px-2.5 py-1 rounded shadow-md cursor-move select-none whitespace-nowrap hover:bg-teal-500/30 transition duration-150 flex items-center gap-1.5"
                          >
                            <svg className="w-3 h-3 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Sign Here
                          </div>
                        ))}
                    </div>

                  </div>

                </div>

                {/* Modal Footer Page Controls */}
                <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-500 font-medium">
                              Page {pageNumber} of {numPages || '?'}
                    </div>
                    {!isSigned && currentDoc?.signerType === 'only-you' && (
                      <button
                        type="button"
                        onClick={handleFinalizeDocument}
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                      >
                        Generate Signed PDF
                      </button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1 bg-slate-100 border border-slate-200 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={pageNumber >= numPages}
                      onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
                      className="px-3 py-1 bg-slate-100 border border-slate-200 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Invite Signer / Share Modal */}
          {isShareModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md flex flex-col shadow-xl p-6 gap-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800">Invite External Signers</h3>
                  <button 
                    onClick={() => { setIsShareModalOpen(false); setShareEmails(''); setShareResults(null); setShareError(''); }}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2 cursor-pointer"
                  >
                    &times;
                  </button>
                </div>

                {shareError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl p-3 font-medium">
                    ⚠️ {shareError}
                  </div>
                )}

                {!shareResults ? (
                  <form onSubmit={handleShareDocument} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Signers' Email Addresses</label>
                      <textarea 
                        rows="4"
                        value={shareEmails}
                        onChange={(e) => setShareEmails(e.target.value)}
                        placeholder="Enter emails (comma-separated or one per line)&#10;e.g. signer1@gmail.com, signer2@gmail.com" 
                        required
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-teal-500 bg-slate-50/50 resize-y"
                      />
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                        Each invited signer will get their own unique secure token, expiry, and email invitation.
                      </p>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isGeneratingLink}
                      className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl py-2 font-bold text-xs transition cursor-pointer shadow-sm"
                    >
                      {isGeneratingLink ? 'Sending Invites...' : 'Invite Signers'}
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Dynamic Status Card */}
                    {shareResults.sent.length > 0 && shareResults.failed.length === 0 ? (
                      <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl p-4 flex flex-col gap-2 font-medium">
                        <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                          ✓ Invitations Emailed!
                        </div>
                        <p className="leading-relaxed text-[11px] text-emerald-700 font-normal">
                          All invitation emails were sent successfully to the signers.
                        </p>
                      </div>
                    ) : shareResults.sent.length > 0 && shareResults.failed.length > 0 ? (
                      <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-xl p-4 flex flex-col gap-2 font-medium">
                        <div className="font-bold text-amber-900 flex items-center gap-1.5">
                          ⚠ Partial Sending Success
                        </div>
                        <p className="leading-relaxed text-[11px] text-amber-700 font-normal">
                          Some emails were sent successfully, but others failed. You can copy the links below to manually share them.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-xl p-4 flex flex-col gap-2 font-medium">
                        <div className="font-bold text-rose-900 flex items-center gap-1.5">
                          ⚠ Email Sending Failed / Skipped
                        </div>
                        <p className="leading-relaxed text-[11px] text-rose-700 font-normal">
                          Emails could not be sent (SMTP config missing or network error). However, the signing links were generated successfully. You can copy them below to share manually.
                        </p>
                      </div>
                    )}

                    {shareResults.sent.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Emailed Successfully ({shareResults.sent.length})</span>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                          {shareResults.sent.map((item, idx) => (
                            <div key={idx} className="p-2.5 flex flex-col gap-1.5 text-xs">
                              <div className="font-semibold text-slate-800 truncate">{item.email}</div>
                              <div className="flex gap-2 items-center">
                                <input 
                                  type="text" 
                                  readOnly 
                                  value={item.link}
                                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[10px] bg-white font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.link);
                                    alert(`Copied link for ${item.email}`);
                                  }}
                                  className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {shareResults.failed.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Failed / Not Sent (Links Available) ({shareResults.failed.length})</span>
                        <div className="max-h-40 overflow-y-auto border border-rose-200 rounded-xl divide-y divide-rose-100 bg-rose-50/20">
                          {shareResults.failed.map((item, idx) => (
                            <div key={idx} className="p-2.5 text-xs flex flex-col gap-1.5">
                              <div className="font-semibold text-rose-900 truncate">{item.email}</div>
                              <div className="text-[10px] text-rose-600 italic font-medium">Reason: {item.error}</div>
                              {item.link && (
                                <div className="flex gap-2 items-center mt-1">
                                  <input 
                                    type="text" 
                                    readOnly 
                                    value={item.link}
                                    className="flex-1 border border-rose-200 rounded-lg px-2 py-1 text-[10px] bg-white font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(item.link);
                                      alert(`Copied link for ${item.email}`);
                                    }}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                                  >
                                    Copy
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {shareResults.skipped.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Skipped Duplicates ({shareResults.skipped.length})</span>
                        <div className="max-h-24 overflow-y-auto border border-amber-200 rounded-xl divide-y divide-amber-100 bg-amber-50/20">
                          {shareResults.skipped.map((email, idx) => (
                            <div key={idx} className="p-2 px-2.5 text-xs text-amber-800 font-medium">
                              {email}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => { setIsShareModalOpen(false); setShareResults(null); }}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-2 font-bold text-xs transition cursor-pointer shadow-sm mt-2"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* View: PUBLIC SIGNING PAGE */}
      {view === 'public-sign' && publicDoc && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                S
              </div>
              <span className="text-md font-bold tracking-tight text-slate-900">
                Secure Public Document Signature Gateway
              </span>
            </div>
          </header>

          {/* Main area split into preview and signature action form */}
          <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col md:flex-row gap-6">
            
            {/* Left: Signature Confirmation Action Card */}
            <div className="w-full md:w-80 flex flex-col gap-4 shrink-0">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {showRejectForm ? 'Reject Document' : 'Complete Your Signature'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    {showRejectForm 
                      ? 'Please provide a brief reason for rejecting this document signature request.'
                      : 'You have been invited to sign this document. Review the PDF and enter your full name below to sign.'
                    }
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3 flex flex-col gap-1 text-[11px] text-slate-500">
                  <div><strong>File Name:</strong> {publicDoc.fileName}</div>
                  <div><strong>Your Email:</strong> {publicDoc.signerEmail}</div>
                </div>

                {!showRejectForm ? (
                  <form onSubmit={handlePublicSign} className="flex flex-col gap-3.5 border-t border-slate-100 pt-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Your Full Name</label>
                      <input 
                        type="text" 
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Type your name to sign" 
                        required
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-teal-500 bg-slate-50/50"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSigningPublic}
                      className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl py-2.5 font-bold text-xs transition cursor-pointer shadow-sm"
                    >
                      {isSigningPublic ? 'Signing Document...' : 'Sign & Complete'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowRejectForm(true)}
                      className="w-full border border-slate-200 hover:border-rose-200 hover:bg-rose-50/35 text-slate-500 hover:text-rose-600 rounded-xl py-2 font-semibold text-[11px] transition cursor-pointer"
                    >
                      Reject Document
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handlePublicReject} className="flex flex-col gap-3.5 border-t border-slate-100 pt-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Rejection Reason</label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Why are you rejecting this document?" 
                        required
                        rows={3}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-rose-500 bg-slate-50/50 resize-none"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isRejectingPublic}
                      className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl py-2.5 font-bold text-xs transition cursor-pointer shadow-sm"
                    >
                      {isRejectingPublic ? 'Rejecting Document...' : 'Confirm Rejection'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectReason('');
                      }}
                      className="w-full border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl py-2 font-semibold text-[11px] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>

              <div className="text-[10px] text-slate-400 leading-relaxed bg-white border border-slate-200/60 p-4 rounded-xl">
                💡 **How it works**: Hover over the document pages to locate the designated **"Sign Here"** boxes. Your typed signature name will be embedded directly in the PDF document at those positions.
              </div>
            </div>

            {/* Right: PDF Previewer */}
            <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-between min-h-[500px]">
              <div 
                className="relative border border-slate-300 shadow-md select-none my-auto"
              >
                <PDFDocument
                  file={previewFileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<div className="text-xs text-slate-500 font-medium">Loading document preview...</div>}
                  error={<div className="text-xs text-rose-500 font-medium">Failed to load PDF preview.</div>}
                >
                  <PDFPage 
                    pageNumber={pageNumber} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    className="max-w-full"
                  />
                </PDFDocument>

                {/* Render absolute overlays of signature positions */}
                {publicSignatures
                  .filter(sig => sig.page === pageNumber)
                  .map((sig, idx) => {
                    const isMine = sig.signerEmail === publicDoc.signerEmail;
                    return (
                      <div
                        key={sig._id || idx}
                        style={{
                          left: `${sig.x}%`,
                          top: `${sig.y}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        className={`absolute border text-[9px] font-bold px-2.5 py-1 rounded shadow-md select-none whitespace-nowrap flex items-center gap-1.5 ${
                          isMine 
                            ? 'bg-teal-500/20 border-teal-500 text-teal-700' 
                            : 'bg-slate-300/30 border-slate-400 text-slate-500 opacity-60'
                        }`}
                      >
                        <svg className={`w-3 h-3 ${isMine ? 'text-teal-600' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        {isMine ? 'Sign Here (You)' : `Sign Here (${sig.signerEmail || 'Other'})`}
                      </div>
                    );
                  })}
              </div>

              {/* Page navigation controls */}
              <div className="flex items-center justify-between w-full border-t border-slate-100 pt-4 mt-6">
                <div className="text-xs text-slate-500 font-medium">
                  Page {pageNumber} of {numPages || '?'}
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1 bg-slate-100 border border-slate-200 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
                    className="px-3 py-1 bg-slate-100 border border-slate-200 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

          </main>
        </div>
      )}

      {/* View: PUBLIC SIGNING SUCCESS */}
      {view === 'public-success' && (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-xl font-bold shadow-sm">
              ✓
            </div>
            <h2 className="text-lg font-bold text-slate-900">Signing Completed!</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Thank you! The document has been finalized and compiled with your signature successfully. 
              The document owner has been notified.
            </p>
            <div className="text-[10px] text-slate-400 italic mt-2">
              You can close this tab now.
            </div>
          </div>
        </div>
      )}

      {/* View: PUBLIC SIGNING REJECTED */}
      {view === 'public-rejected' && (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600 text-lg font-bold shadow-sm">
              ✕
            </div>
            <h2 className="text-lg font-bold text-slate-900">Document Rejected</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              You have rejected this document signature request. The document status has been updated to rejected, and the owner has been notified.
            </p>
            <div className="text-[10px] text-slate-400 italic mt-2">
              You can close this tab now.
            </div>
          </div>
        </div>
      )}

      {/* View: PUBLIC SIGNING ERROR */}
      {view === 'public-error' && (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600 text-lg font-bold shadow-sm">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-slate-900">Access Error</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {publicSignError || 'The public signing link is invalid, has expired, or has already been used.'}
            </p>
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('token');
                window.history.replaceState({}, document.title, url.pathname);
                setView('login');
              }}
              className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Go to Login Page
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
export { App };
