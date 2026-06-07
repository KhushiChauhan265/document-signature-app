import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

  // Auto-login if token exists in localStorage on mount
  useEffect(() => {
    if (token) {
      setView('dashboard');
      fetchUserProfile(token);
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
      // Reset form fields
      e.target.reset();
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

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('docSignToken');
    setToken('');
    setUser(null);
    setSuccessMessage('');
    setErrorMessage('');
    setUploadError('');
    setUploadSuccess('');
    setSelectedFile(null);
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
          <main className="flex-1 max-w-2xl w-full mx-auto p-6 lg:p-8 flex flex-col gap-6">
            
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

            {/* Document Workspace Placeholder Empty State */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-slate-700">No documents in this workspace</h3>
              <p className="text-[11px] text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Your workspace documents will appear here once the document database viewing flow (Day 4) is completed.
              </p>
            </div>

          </main>

        </div>
      )}

    </div>
  );
}

export default App;
export { App };
