import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function GoogleAuthButton({ compact = false, text = 'signin_with' }) {
  const { loginWithGoogle, googleClientId } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  async function handleSuccess(credentialResponse) {
    if (!credentialResponse?.credential) {
      toast.error('Google sign in did not return valid credentials.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithGoogle(credentialResponse.credential);
      toast.success(`Welcome back, ${res.user.name}!`);
    } catch (err) {
      toast.error(err.message || 'Google sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleError() {
    toast.error('Google sign in failed. Please try again.');
  }

  // If no Google Client ID is configured yet, show a helpful fallback button
  if (!googleClientId) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="inline-flex items-center justify-center gap-2.5 bg-bg-surface hover:bg-bg-elevated border border-bg-border text-gray-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition duration-150 active:scale-[0.98] shadow-sm hover:border-gray-600"
        >
          <GoogleIcon />
          <span>Sign in with Google</span>
        </button>

        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
            <div className="card max-w-md w-full p-6 animate-slide-up bg-bg-surface border border-bg-border shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                    <GoogleIcon />
                  </div>
                  <h3 className="text-base font-bold text-gray-100">Google OAuth Setup</h3>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-gray-400 hover:text-gray-200 text-lg leading-none p-1"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-300 mb-4 leading-relaxed">
                To enable live Google Sign-In, add your Google OAuth Client ID to your environment variables:
              </p>

              <div className="bg-bg rounded-xl p-3 text-[11px] font-mono text-gray-300 border border-bg-border space-y-2 mb-4 overflow-x-auto">
                <div className="text-gray-400"># In backend/.env</div>
                <div>GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com</div>
                <div className="text-gray-400 mt-2"># In frontend/.env</div>
                <div>VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com</div>
              </div>

              <div className="text-[11px] text-gray-400 space-y-1 mb-6">
                <div>1. Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-accent underline hover:text-accent-hover">Google Cloud Console</a>.</div>
                <div>2. Create an OAuth 2.0 Client ID (Web application).</div>
                <div>3. Add <code className="text-gray-300 bg-bg-elevated px-1 py-0.5 rounded">http://localhost:5173</code> to Authorized JavaScript Origins.</div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="btn-primary w-full !py-2.5 text-xs"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`google-auth-wrapper inline-flex ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        theme="filled_black"
        shape="pill"
        size={compact ? 'medium' : 'large'}
        text={text}
        locale="en"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}
