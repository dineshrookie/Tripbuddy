import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, loginWithEmail, signUpWithEmail } from '../firebase/authService';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/home', { replace: true });
  }, [user, navigate]);

  async function handleGoogleSignIn() {
    setError(''); setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    if (result.success) navigate('/home', { replace: true });
    else setError(result.error || 'Google sign-in failed');
  }

  async function handleEmailSubmit() {
    if (!email.trim()) { setError('Enter your email'); return; }
    if (!password) { setError('Enter your password'); return; }
    if (mode === 'signup' && password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setError(''); setLoading(true);
    let result;
    if (mode === 'signup') {
      result = await signUpWithEmail(email.trim(), password, name.trim() || 'Rider');
    } else {
      result = await loginWithEmail(email.trim(), password);
    }
    setLoading(false);
    if (result.success) navigate('/home', { replace: true });
    else setError(result.error || 'Authentication failed');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleEmailSubmit();
  }

  return (
    <div className="login-screen">
      <button className="btn-icon mb-24" onClick={() => navigate('/')}>←</button>

      <h1 className="screen-title">{mode === 'signup' ? 'Create account' : 'Welcome back'}</h1>
      <p className="screen-desc">
        {mode === 'signup'
          ? 'Sign up to start tracking group rides.'
          : 'Sign in to continue your ride.'}
      </p>

      {/* Google Sign-In Button */}
      <button
        className="google-signin-btn mb-20"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <svg viewBox="0 0 48 48" width="20" height="20">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        <span>Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="auth-divider mb-20">
        <span>or</span>
      </div>

      {/* Email/Password Form */}
      {mode === 'signup' && (<>
        <div className="input-label">Your Name</div>
        <input className="input mb-16" type="text" placeholder="Arjun Kumar" value={name}
          onChange={e => setName(e.target.value)} maxLength={50} onKeyDown={handleKeyDown} />
      </>)}

      <div className="input-label">Email</div>
      <input className="input mb-16" type="email" placeholder="rider@example.com" value={email}
        onChange={e => setEmail(e.target.value)} autoFocus onKeyDown={handleKeyDown} />

      <div className="input-label">Password</div>
      <input className="input mb-20" type="password" placeholder="••••••••" value={password}
        onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} />

      {error && <div className="error-msg">{error}</div>}

      <button className="btn btn-primary mb-16" onClick={handleEmailSubmit} disabled={loading}>
        {loading ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : (mode === 'signup' ? 'Create Account' : 'Sign In')}
      </button>

      <div className="auth-switch">
        {mode === 'login' ? (
          <>Don't have an account? <span onClick={() => { setMode('signup'); setError(''); }}>Sign up</span></>
        ) : (
          <>Already have an account? <span onClick={() => { setMode('login'); setError(''); }}>Sign in</span></>
        )}
      </div>
    </div>
  );
}