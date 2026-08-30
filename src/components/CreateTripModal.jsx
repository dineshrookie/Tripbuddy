import { useState } from 'react';
import { createTrip } from '../firebase/tripService';

export default function CreateTripModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleCreate() {
    if (!name.trim()) { setError('Trip name is required'); return; }
    if (!destination.trim()) { setError('Destination is required'); return; }
    setError(''); setLoading(true);
    try {
      const res = await createTrip({ name: name.trim(), destination: destination.trim() });
      setResult(res);
    } catch (err) {
      setError(err.message || 'Failed to create trip');
    }
    setLoading(false);
  }

  function handleCopyCode() {
    if (result?.code) {
      navigator.clipboard.writeText(result.code).catch(() => {});
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        {!result ? (<>
          <h2 className="modal-title">Start a New Trip</h2>
          <p className="modal-desc">Create a session and invite your riders</p>
          <div className="input-label">Trip Name</div>
          <input className="input mb-16" placeholder="Ooty Weekend Ride" value={name}
            onChange={e => setName(e.target.value)} autoFocus />
          <div className="input-label">Destination</div>
          <input className="input mb-20" placeholder="Ooty, Tamil Nadu" value={destination}
            onChange={e => setDestination(e.target.value)} />
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Trip →'}
          </button>
        </>) : (<>
          <h2 className="modal-title">Trip Created! 🎉</h2>
          <p className="modal-desc">Share this code with your riders</p>
          <div className="trip-code-display" onClick={handleCopyCode} style={{cursor:'pointer'}}>
            <div className="code">{result.code}</div>
            <div className="hint">Tap to copy</div>
          </div>
          <button className="btn btn-primary mb-12" onClick={() => onCreated(result)}>
            Go to Trip Map →
          </button>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </>)}
      </div>
    </div>
  );
}