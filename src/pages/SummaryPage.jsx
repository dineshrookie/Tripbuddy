import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTrip } from '../firebase/tripService';
import { useAuth } from '../context/AuthContext';

const RIDER_COLORS = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#f59e0b'];

export default function SummaryPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const t = await getTrip(tripId);
        setTrip(t);
      } catch (err) {
        console.error('Failed to load trip:', err);
      }
      setLoading(false);
    }
    load();
  }, [tripId]);

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p className="text-muted">Loading summary...</p></div>;
  }

  if (!trip) {
    return (
      <div className="loading-screen">
        <div className="empty-state">
          <div className="icon">❌</div>
          <h3>Trip not found</h3>
          <p>This trip may have been deleted</p>
          <button className="btn btn-primary btn-sm" style={{marginTop:16, width:'auto'}} onClick={() => navigate('/home')}>Go Home</button>
        </div>
      </div>
    );
  }

  const summary = trip.summary;
  const riders = summary?.riders || [];
  const duration = summary?.durationMinutes || 0;
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const totalDist = summary?.totalDistanceKm || 0;
  const stopCount = summary?.stopCount || 0;
  const memberCount = (trip.memberIds || []).length;
  const tripDate = trip.createdAt?.toDate ? new Date(trip.createdAt.toDate()).toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric'
  }) : '';

  async function handleShare() {
    const text = `🏍️ TripBuddy — ${trip.name}\n📏 ${Math.round(totalDist)} km · ⏱️ ${durationStr}\n🏍️ ${memberCount} riders · ☕ ${stopCount} stops\n\nTracked with TripBuddy!`;
    if (navigator.share) {
      try { await navigator.share({ title: `Trip: ${trip.name}`, text }); } catch {}
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      alert('Summary copied to clipboard!');
    }
  }

  return (
    <div className="summary-screen">
      <div className="summary-header">
        <button className="btn-icon" style={{background:'rgba(255,255,255,0.1)', color:'#fff', border:'none', marginBottom:10}}
          onClick={() => navigate('/home')}>← Home</button>
        <h2>Trip Complete! 🏁</h2>
        <p>{trip.name} · {tripDate}</p>
      </div>

      <div style={{overflowY:'auto', flex:1, paddingBottom:20}}>
        {/* Stats Grid */}
        <div className="summary-stats">
          <div className="sum-card">
            <div className="sum-icon">📏</div>
            <div className="sum-val">{Math.round(totalDist)}</div>
            <div className="sum-unit">km</div>
            <div className="sum-lbl">Total distance</div>
          </div>
          <div className="sum-card">
            <div className="sum-icon">⏱️</div>
            <div className="sum-val">{durationStr}</div>
            <div className="sum-unit"></div>
            <div className="sum-lbl">Duration</div>
          </div>
          <div className="sum-card">
            <div className="sum-icon">🏍️</div>
            <div className="sum-val">{memberCount}</div>
            <div className="sum-unit">riders</div>
            <div className="sum-lbl">All completed</div>
          </div>
          <div className="sum-card">
            <div className="sum-icon">☕</div>
            <div className="sum-val">{stopCount}</div>
            <div className="sum-unit">stops</div>
            <div className="sum-lbl">Along the way</div>
          </div>
        </div>

        {/* Rider Performance */}
        {riders.length > 0 && (
          <div className="riders-section">
            <div className="stops-title">Rider performance</div>
            {riders.map((r, i) => (
              <div key={r.userId} className="rider-summary-row">
                <div className="rider-avatar" style={{
                  background: i === 0 ? 'var(--primary-light)' : i === 1 ? 'var(--blue-light)' : 'var(--green-light)',
                  borderColor: RIDER_COLORS[i % RIDER_COLORS.length],
                  width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  border: `2px solid ${RIDER_COLORS[i % RIDER_COLORS.length]}`
                }}>🏍️</div>
                <div>
                  <div style={{fontSize:13, fontWeight:700, color:'var(--gray-900)'}}>
                    {r.name}{r.userId === user?.uid ? ' (You)' : ''}
                  </div>
                  <div style={{fontSize:11, color:'var(--gray-500)'}}>
                    {Math.round(r.distanceKm)} km traveled
                  </div>
                </div>
                <div style={{marginLeft:'auto', fontSize:13, fontWeight:700, color: RIDER_COLORS[i % RIDER_COLORS.length]}}>
                  {Math.round(r.distanceKm)} km
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Share */}
        <button className="share-btn" onClick={handleShare}>📤 Share Trip Summary</button>
      </div>
    </div>
  );
}