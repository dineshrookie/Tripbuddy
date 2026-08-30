import { useState } from 'react';
import { joinTrip } from '../firebase/tripService';

export default function JoinTripModal({ onClose, onJoined }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin() {
    if (code.trim().length < 4) { setError('Enter a valid trip code'); return; }
    setError(''); setLoading(true);
    try {
      const result = await joinTrip(code.trim());
      onJoined(result);
    } catch (err) {
      setError(err.message || 'Trip not found');
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">Join a Trip</h2>
        <p className="modal-desc">Enter the trip code shared by your ride leader</p>
        <div className="input-label">Trip Code</div>
        <input className="input mb-20" placeholder="TB4829X" value={code}
          onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8}
          style={{textAlign:'center', fontSize:20, fontWeight:800, letterSpacing:4}} autoFocus />
        {error && <div className="error-msg">{error}</div>}
        <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>
          {loading ? 'Joining...' : 'Join Trip →'}
        </button>
      </div>
    </div>
  );
}