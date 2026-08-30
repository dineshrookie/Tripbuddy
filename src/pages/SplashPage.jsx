import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

export default function SplashPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate('/home', { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="splash-screen">
      <div className="logo-circle">
        <svg viewBox="0 0 52 52" fill="none" width="52" height="52">
          <circle cx="14" cy="38" r="6" stroke="white" strokeWidth="2.5"/>
          <circle cx="38" cy="38" r="6" stroke="white" strokeWidth="2.5"/>
          <path d="M8 38L20 20H34L44 38" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M20 20L22 14H30L34 20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="26" cy="12" r="3" fill="white"/>
        </svg>
      </div>
      <div className="splash-title">Trip<span className="text-primary">Buddy</span></div>
      <div className="splash-sub">Track your group. Stay together.<br/>Never lose your ride again.</div>
      <button className="btn btn-primary mb-12" onClick={() => navigate('/login')}>Get Started →</button>
      <button className="btn btn-secondary" onClick={() => navigate('/login')}>I already have an account</button>
    </div>
  );
}