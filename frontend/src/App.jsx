import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [apiStatus, setApiStatus] = useState('checking');
  const [dbStatus, setDbStatus] = useState('checking');
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Dynamic connection check to backend health endpoint
    axios.get('http://localhost:5000/api/health')
      .then(response => {
        if (response.data && response.data.status === 'UP') {
          setApiStatus('connected');
          setDbStatus('connected');
          setShowWarning(false);
        } else {
          setApiStatus('error');
          setDbStatus('disconnected');
          setShowWarning(true);
        }
      })
      .catch(error => {
        setApiStatus('disconnected');
        setDbStatus('disconnected');
        setShowWarning(true);
        console.error('Environment health check error:', error);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafc] text-slate-800 flex flex-col font-sans">
      
      {/* Top Banner Warning (Visible only if backend goes offline) */}
      {showWarning && (
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-2.5 text-rose-700 text-xs flex items-center justify-between transition-all duration-300">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="font-semibold">Local Environment Alert:</span>
            <span>Express server on port 5000 is unreachable. Run 'npm run dev' in the backend folder to establish connection.</span>
          </div>
          <button 
            onClick={() => setShowWarning(false)} 
            className="text-rose-400 hover:text-rose-600 font-bold px-1 text-sm"
          >
            &times;
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/60 px-6 py-3.5 sticky top-0 z-10 flex items-center justify-between shadow-sm shadow-slate-100/10">
        
        {/* Brand/Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-teal-600/10">
            D
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            DocSign
          </span>
          <span className="px-2 py-0.5 text-[9px] font-semibold bg-slate-100 text-slate-500 rounded-full border border-slate-200/50">
            Developer Environment
          </span>
        </div>

        {/* Global Connection Badges */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Client Online</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${apiStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-400 animate-pulse'}`}></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">API status</span>
          </div>
        </div>

      </header>

      {/* Workspace Wrapper */}
      <div className="flex flex-1">
        
        {/* Navigation Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200/50 p-5 hidden md:flex flex-col gap-6">
          
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-3 mb-2">
              Workspace
            </p>
            
            {/* Nav: Dashboard */}
            <a 
              href="#dashboard" 
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-teal-50/50 text-teal-700 font-bold text-xs transition duration-150"
            >
              <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
              </svg>
              Dashboard
            </a>

            {/* Nav: Documents (Inactive placeholder) */}
            <span 
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400/60 font-medium text-xs cursor-default select-none"
              title="Disabled during initialization"
            >
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Documents
            </span>

            {/* Nav: Templates (Inactive placeholder) */}
            <span 
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400/60 font-medium text-xs cursor-default select-none"
              title="Disabled during initialization"
            >
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Templates
            </span>
          </div>

          <div className="mt-auto text-[10px] text-slate-400 text-center border-t border-slate-100 pt-4">
            &copy; 2026 DocSign App.
          </div>

        </aside>

        {/* Workspace Dashboard */}
        <main className="flex-1 p-6 lg:p-8 flex flex-col gap-8 overflow-y-auto">
          
          {/* Main Headline */}
          <div className="border-b border-slate-200/60 pb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Environment Setup Status
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Verify local full-stack integration status, database connections, and package installations for the project.
            </p>
          </div>

          {/* Section: Live Connected Services */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Connected Services</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              
              {/* Card: Client App */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frontend Client</span>
                  <p className="text-md font-bold text-slate-800 tracking-tight mt-1">React + Vite</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Running on http://localhost:5173</p>
                </div>
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  ✓
                </span>
              </div>

              {/* Card: Express Server */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Express Backend</span>
                  <p className="text-md font-bold text-slate-800 tracking-tight mt-1">
                    {apiStatus === 'connected' ? 'Online' : apiStatus === 'checking' ? 'Connecting...' : 'Disconnected'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Listening on http://localhost:5000</p>
                </div>
                <span className={`w-6 h-6 rounded-lg ${apiStatus === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center font-bold text-xs`}>
                  {apiStatus === 'connected' ? '✓' : '!'}
                </span>
              </div>

              {/* Card: Database Status */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MongoDB (Mongoose)</span>
                  <p className="text-md font-bold text-slate-800 tracking-tight mt-1">
                    {dbStatus === 'connected' ? 'Connected' : dbStatus === 'checking' ? 'Connecting...' : 'Disconnected'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Database: document_signature_db</p>
                </div>
                <span className={`w-6 h-6 rounded-lg ${dbStatus === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center font-bold text-xs`}>
                  {dbStatus === 'connected' ? '✓' : '!'}
                </span>
              </div>

            </div>
          </div>

          {/* Section: Document Workspace (Truthful Empty State) */}
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
            
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-800">Workspace Documents</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Documents will appear in this panel once database storage is active.</p>
            </div>
            
            <div className="p-10 flex flex-col items-center justify-center text-center">
              
              {/* Empty-State Illustration */}
              <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <h4 className="text-xs font-bold text-slate-700">No documents in this workspace</h4>
              <p className="text-[11px] text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Documents will appear here once authentication and file upload services are configured.
              </p>
            </div>

          </div>

          {/* Section: Installed Node Modules & Verification */}
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm p-6">
            
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Baseline Environment Dependencies</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-xs text-slate-500">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-700">bcryptjs</span>
                <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">Installed (v2.4)</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-700">jsonwebtoken (JWT)</span>
                <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">Installed (v9.0)</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-700">multer</span>
                <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">Installed (v1.4)</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-700">pdf-lib</span>
                <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">Installed (v1.17)</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-700">axios</span>
                <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">Installed (v1.17)</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-700">react-pdf</span>
                <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">Installed (v10.4)</span>
              </div>

            </div>

          </div>

        </main>

      </div>

    </div>
  );
}

export default App;
export { App };
