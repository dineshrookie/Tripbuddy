import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyTrips } from '../firebase/tripService';
import BottomNav from '../components/BottomNav';
import CreateTripModal from '../components/CreateTripModal';
import JoinTripModal from '../components/JoinTripModal';

const COLORS = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#f59e0b', '#EF4444'];

export default function HomePage() {
  const { user, userName } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    try {
      const data = await getMyTrips();
      setTrips(data);
    } catch (err) { console.error('Failed to load trips:', err); }
    setLoading(false);
  }

  const totalKm = trips.reduce((sum, t) => {
    const myDist = t.memberDistances?.[user?.uid] || 0;
    return sum + myDist;
  }, 0);

  const buddySet = new Set();
  trips.forEach(t => (t.memberIds || []).forEach(id => { if (id !== user?.uid) buddySet.add(id); }));

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  function handleTripCreated(result) {
    setShowCreate(false);
    navigate(`/trip/${result.tripId}`);
  }

  function handleTripJoined(result) {
    setShowJoin(false);
    navigate(`/trip/${result.tripId}`);
  }

  const activeTrips = trips.filter(t => t.status === 'active' || t.status === 'waiting');
  const pastTrips = trips.filter(t => t.status === 'ended');

  return (
    <div className="home-screen">
      <div className="home-header">
        <div className="home-header-row">
          <div>
            <div className="text-sm text-muted" style={{fontWeight:500}}>{greeting},</div>
            <div className="greeting">{userName || 'Rider'} <span>🏍️</span></div>
          </div>
          <div className="avatar">{(userName || 'R')[0].toUpperCase()}</div>
        </div>
      </div>

      <div className="home-body">
        {/* Active trip banner */}
        {activeTrips.length > 0 && (
          <div className="card" style={{background:'var(--green-light)', borderLeft:'4px solid var(--green)', marginBottom:14}}>
            <div style={{fontWeight:700, color:'var(--green)', fontSize:13}}>🟢 Active Trip</div>
            <div style={{fontWeight:700, marginTop:4}}>{activeTrips[0].name}</div>
            <button className="btn btn-sm" style={{marginTop:8, background:'var(--green)', color:'#fff', border:'none'}}
              onClick={() => navigate(`/trip/${activeTrips[0].tripId}`)}>
              Rejoin Map →
            </button>
          </div>
        )}

        {/* Create Trip */}
        <div className="create-trip-card" onClick={() => setShowCreate(true)}>
          <h3>Start a New Trip</h3>
          <p>Create session & invite your riders</p>
          <div className="arrow">→</div>
        </div>

        {/* Join Trip */}
        <div className="card">
          <button className="join-btn" onClick={() => setShowJoin(true)}>
            <span style={{fontSize:18}}>🔗</span>
            <span>Join with code / link</span>
          </button>
        </div>

        {/* Stats */}
        <div className="card">
          <div className="card-title">Your Riding Squad</div>
          <div className="stat-row">
            <div className="stat-box"><div className="stat-num">{trips.length}</div><div className="stat-label">Trips done</div></div>
            <div className="stat-box"><div className="stat-num">{totalKm >= 1000 ? (totalKm/1000).toFixed(1)+'k' : Math.round(totalKm).toLocaleString()}</div><div className="stat-label">km ridden</div></div>
            <div className="stat-box"><div className="stat-num">{buddySet.size}</div><div className="stat-label">Buddies</div></div>
          </div>
        </div>

        {/* Recent Trips */}
        <div className="card">
          <div className="card-title">Recent trips</div>
          {loading ? (
            <div style={{textAlign:'center', padding:20}}><div className="spinner" style={{margin:'0 auto'}} /></div>
          ) : pastTrips.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🛣️</div>
              <h3>No trips yet</h3>
              <p>Start your first group ride!</p>
            </div>
          ) : (
            pastTrips.slice(0, 5).map((trip, i) => (
              <div key={trip.tripId} className="trip-item" style={{cursor:'pointer'}}
                onClick={() => navigate(`/summary/${trip.tripId}`)}>
                <div className="trip-dot" style={{background: COLORS[i % COLORS.length]}} />
                <div>
                  <div className="trip-name">{trip.name}</div>
                  <div className="trip-meta">
                    {trip.createdAt?.toDate ? new Date(trip.createdAt.toDate()).toLocaleDateString('en-IN', {month:'short', day:'numeric'}) : ''} · {(trip.memberIds||[]).length} riders
                  </div>
                </div>
                <div className="trip-dist">{Math.round(trip.memberDistances?.[user?.uid] || 0)} km</div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
      {showCreate && <CreateTripModal onClose={() => setShowCreate(false)} onCreated={handleTripCreated} />}
      {showJoin && <JoinTripModal onClose={() => setShowJoin(false)} onJoined={handleTripJoined} />}
    </div>
  );
}