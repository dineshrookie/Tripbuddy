import { useState } from 'react';

export default function SOSModal({ onClose, onConfirm }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSOS() {
    setLoading(true);
    await onConfirm(message || null);
    setLoading(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{textAlign:'center', marginBottom:16}}>
          <div style={{fontSize:48, marginBottom:8}}>🆘</div>
          <h2 className="modal-title" style={{color:'var(--red)'}}>Emergency SOS</h2>
          <p className="modal-desc">This will alert ALL riders in your group with your location</p>
        </div>
        <div className="input-label">What happened? (optional)</div>
        <input className="input mb-20" placeholder="e.g. Tyre puncture, accident..." value={message}
          onChange={e => setMessage(e.target.value)} />
        <button className="btn btn-danger mb-12" onClick={handleSOS} disabled={loading}
          style={{width:'100%'}}>
          {loading ? 'Sending Alert...' : '🆘 Send SOS Alert'}
        </button>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}