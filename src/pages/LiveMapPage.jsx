import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { useLocationTracker, useStopDetection, useTripListeners, useNotificationPermission } from '../hooks/useTripBuddy';
import { triggerSOS } from '../firebase/locationService';
import { startTrip, endTrip, getTrip } from '../firebase/tripService';
import BottomNav from '../components/BottomNav';
import SOSModal from '../components/SOSModal';
import AlertToast from '../components/AlertToast';

const RIDER_COLORS = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#f59e0b', '#EF4444'];

function createRiderIcon(color, emoji = '🏍️') {
  return L.divIcon({
    className: 'rider-marker-icon',
    html: `<div class="rider-marker-label">
      <div class="rider-marker-bubble" style="background:${color}">${emoji}</div>
    </div>`,
    iconSize: [36, 50],
    iconAnchor: [18, 50],
  });
}

function createDestIcon() {
  return L.divIcon({
    className: 'rider-marker-icon',
    html: '<div style="font-size:28px;text-align:center">📍</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function LiveMapPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { user, userName } = useAuth();
  const [tripDetails, setTripDetails] = useState(null);
  const [showSOS, setShowSOS] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  useNotificationPermission();

  const isActive = tripDetails?.status === 'active';
  const isHost = tripDetails?.hostId === user?.uid;

  // Location tracker — only pushes when trip is active
  const { myLocation, locationError } = useLocationTracker(tripId, userName, isActive);

  // Stop detection
  useStopDetection(tripId, myLocation, userName);

  // Real-time listeners for all riders + events
  const { riders, events, trip, distances, latestSOS, latestStop } = useTripListeners(tripId);

  // Sync trip data
  useEffect(() => {
    if (trip) setTripDetails(trip);
  }, [trip]);

  // Load initial trip data
  useEffect(() => {
    async function load() {
      try {
        const t = await getTrip(tripId);
        setTripDetails(t);
      } catch (err) {
        setToast({ icon: '❌', text: 'Trip not found', type: 'sos' });
        setTimeout(() => navigate('/home'), 2000);
      }
    }
    load();
  }, [tripId, navigate]);

  // React to new SOS events
  useEffect(() => {
    if (latestSOS && latestSOS.userId !== user?.uid) {
      setToast({
        icon: '🆘', type: 'sos',
        text: `${latestSOS.senderName || 'A rider'} triggered SOS!`,
        sub: latestSOS.message || 'Emergency alert sent',
      });
    }
  }, [latestSOS, user?.uid]);

  // React to stop events
  useEffect(() => {
    if (latestStop && latestStop.userId !== user?.uid) {
      setToast({
        icon: '⚠️', type: 'info',
        text: `${latestStop.userName || 'A rider'} stopped!`,
        sub: `Idle for ${Math.round((latestStop.durationMs || 180000) / 60000)} min`,
      });
    }
  }, [latestStop, user?.uid]);

  // Navigate to summary when trip ends
  useEffect(() => {
    if (tripDetails?.status === 'ended') {
      setTimeout(() => navigate(`/summary/${tripId}`), 1500);
    }
  }, [tripDetails?.status, tripId, navigate]);

  const handleSOS = useCallback(async (message) => {
    if (!myLocation) return;
    await triggerSOS({
      tripId, lat: myLocation.lat, lng: myLocation.lng,
      message, allRiders: riders,
    });
    setToast({ icon: '🆘', text: 'SOS Alert sent!', sub: 'All riders notified', type: 'sos' });
  }, [tripId, myLocation, riders]);

  async function handleStartTrip() {
    setActionLoading('start');
    try {
      await startTrip(tripId);
      setToast({ icon: '🚀', text: 'Trip started!', sub: 'GPS tracking is now active' });
    } catch (err) {
      setToast({ icon: '❌', text: err.message, type: 'sos' });
    }
    setActionLoading('');
  }

  async function handleEndTrip() {
    if (!window.confirm('End this trip? This will generate the trip summary.')) return;
    setActionLoading('end');
    try {
      await endTrip(tripId);
    } catch (err) {
      setToast({ icon: '❌', text: err.message, type: 'sos' });
    }
    setActionLoading('');
  }

  const mapCenter = useMemo(() => {
    if (myLocation) return [myLocation.lat, myLocation.lng];
    if (riders.length > 0) return [riders[0].lat, riders[0].lng];
    if (tripDetails?.destinationLat) return [tripDetails.destinationLat, tripDetails.destinationLng];
    return [11.0168, 76.9558]; // Default: Coimbatore
  }, [myLocation, riders, tripDetails]);

  const me = riders.find(r => r.userId === user?.uid);
  const others = riders.filter(r => r.userId !== user?.uid);
  const leader = [...riders].sort((a, b) => (b.speed || 0) - (a.speed || 0))[0];
  const groupSpread = distances.length > 0 ? distances[distances.length - 1]?.distanceKm : 0;

  return (
    <div className="map-screen">
      {/* Map */}
      <div className="map-area">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={mapCenter} />

          {/* My marker */}
          {me && (
            <Marker position={[me.lat, me.lng]} icon={createRiderIcon(RIDER_COLORS[0])}>
              <Popup>You ({userName}) · {Math.round(me.speed || 0)} km/h</Popup>
            </Marker>
          )}

          {/* Other riders */}
          {others.map((r, i) => (
            r.lat && r.lng && (
              <Marker key={r.userId} position={[r.lat, r.lng]} icon={createRiderIcon(RIDER_COLORS[(i + 1) % RIDER_COLORS.length])}>
                <Popup>{r.name} · {Math.round(r.speed || 0)} km/h</Popup>
              </Marker>
            )
          ))}

          {/* Destination */}
          {tripDetails?.destinationLat && (
            <Marker position={[tripDetails.destinationLat, tripDetails.destinationLng]} icon={createDestIcon()}>
              <Popup>{tripDetails.destination}</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Overlays */}
        <div className="trip-code-badge">
          <div style={{fontSize:10, color:'var(--gray-500)'}}>Trip code</div>
          <div className="code">{tripDetails?.code || '...'}</div>
        </div>

        <div className="trip-status-badge">
          {tripDetails?.status === 'active' ? `Trip Active · ${tripDetails?.name}` :
           tripDetails?.status === 'waiting' ? `Waiting · ${tripDetails?.name}` :
           `${tripDetails?.status || '...'} · ${tripDetails?.name || ''}`}
        </div>

        {/* SOS Button — only when active */}
        {isActive && <button className="sos-btn" onClick={() => setShowSOS(true)}>SOS</button>}
      </div>

      {/* Waiting state — host can start */}
      {tripDetails?.status === 'waiting' && (
        <div style={{padding:14, background:'#fff', textAlign:'center'}}>
          <p style={{fontSize:13, color:'var(--gray-500)', marginBottom:10}}>
            {(tripDetails.memberIds || []).length} rider(s) joined · Waiting to start
          </p>
          {isHost && (
            <button className="btn btn-primary" onClick={handleStartTrip} disabled={actionLoading === 'start'}>
              {actionLoading === 'start' ? 'Starting...' : '🚀 Start Trip'}
            </button>
          )}
        </div>
      )}

      {/* Rider Panel */}
      {isActive && (
        <div className="map-panel">
          <div className="panel-title">
            Riders ({riders.length})
            <span className="live-badge">● LIVE</span>
          </div>

          {/* You */}
          {me && (
            <div className="rider-row">
              <div className="rider-avatar" style={{background:'var(--primary-light)', borderColor:'var(--primary)'}}>🏍️</div>
              <div className="rider-details">
                <div className="rname">You ({userName})</div>
                <div className="rstat">Moving · {Math.round(me.speed || 0)} km/h</div>
              </div>
              <div className="rider-dist you">— km</div>
            </div>
          )}

          {/* Others */}
          {others.map((r, i) => {
            const dist = distances.find(d => d.userId === r.userId);
            const isStopped = (r.speed || 0) < 5;
            return (
              <div key={r.userId} className="rider-row">
                <div className="rider-avatar" style={{
                  background: i === 0 ? 'var(--blue-light)' : i === 1 ? 'var(--green-light)' : 'var(--purple-light)',
                  borderColor: RIDER_COLORS[(i + 1) % RIDER_COLORS.length]
                }}>🏍️</div>
                <div className="rider-details">
                  <div className="rname">{r.name}</div>
                  <div className={`rstat ${isStopped ? 'stopped' : ''}`}>
                    {isStopped ? '⏸ Stopped' : `Moving · ${Math.round(r.speed || 0)} km/h`}
                  </div>
                </div>
                <div className="rider-dist">{dist ? dist.distanceKm.toFixed(1) + ' km' : '...'}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Group insights */}
      {isActive && distances.length > 0 && (
        <>
          <div className="group-insight">
            <div className="label">Group Insight</div>
            <div className="value">
              {distances[0] ? `You are ${distances[0].distanceKm.toFixed(1)} km from ${distances[0].name}` : ''}
            </div>
          </div>
          <div className="group-status">
            <div className="label">Group Status</div>
            <div className="value">
              Leader: {leader?.name || '...'} · Group spread: {groupSpread?.toFixed(1) || '0'} km
            </div>
          </div>
        </>
      )}

      {/* End Trip button for host */}
      {isActive && isHost && (
        <div style={{padding:'0 14px 8px'}}>
          <button className="btn btn-danger btn-sm w-full" onClick={handleEndTrip} disabled={actionLoading === 'end'}>
            {actionLoading === 'end' ? 'Ending...' : '🏁 End Trip'}
          </button>
        </div>
      )}

      {locationError && (
        <div className="error-msg" style={{margin:'0 14px 8px'}}>📍 {locationError}</div>
      )}

      <BottomNav tripId={tripId} mapActive />
      {showSOS && <SOSModal onClose={() => setShowSOS(false)} onConfirm={handleSOS} />}
      {toast && <AlertToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}