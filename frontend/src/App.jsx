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

  // Auto-login if token exists in localStorage on mount
  useEffect(() => {
    if (token) {
      setView('dashboard');
      fetchUserProfile(token);
      fetchDocuments(token);
    }
  }, [token]);

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
    if (!activeDocumentId) return;

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
      {view !== 'dashboard' && (
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
                          </td>
                          <td className="py-3.5 px-2 text-right">
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
                    <h3 className="text-sm font-bold text-slate-800">PDF Document Editor</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Drag fields from the sidebar and drop them on the document pages.</p>
                  </div>
                  <button 
                    onClick={() => { setPreviewFileUrl(''); setActiveDocumentId(''); setSignatures([]); }}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2 cursor-pointer"
                  >
                    &times;
                  </button>
                </div>

                {/* Editor Content Area (Split View) */}
                <div className="flex flex-1 min-h-[450px]">
                  
                  {/* Left Column: Draggable Fields Palette */}
                  <div className="w-56 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Signature Tools</span>
                    
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
                      {signatures
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
            </div>
          )}

        </div>
      )}

    </div>
  );
}

export default App;
export { App };
