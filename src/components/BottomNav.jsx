import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from '../firebase/authService';

const NAV_ITEMS = [
  { icon: '🏠', label: 'Home', path: '/home' },
  { icon: '🗺️', label: 'Map', path: '/map' },
  { icon: '👥', label: 'Buddies', path: '/buddies' },
  { icon: '🚪', label: 'Logout', action: 'logout' },
];

export default function BottomNav({ tripId, mapActive }) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = tripId
    ? [
        { icon: '🏠', label: 'Home', path: '/home' },
        { icon: '🗺️', label: 'Map', path: `/trip/${tripId}` },
        { icon: '🏁', label: 'End Trip', path: `/summary/${tripId}` },
        { icon: '🚪', label: 'Logout', action: 'logout' },
      ]
    : NAV_ITEMS;

  return (
    <div className="bottom-nav">
      {items.map((item) => (
        <button key={item.label} className={`nav-item ${location.pathname === item.path || (mapActive && item.label === 'Map') ? 'active' : ''}`}
          onClick={async () => {
            if (item.action === 'logout') {
              await signOut();
            } else {
              navigate(item.path);
            }
          }}>
          <div className="nav-icon">{item.icon}</div>
          <div className="nav-label">{item.label}</div>
        </button>
      ))}
    </div>
  );
}