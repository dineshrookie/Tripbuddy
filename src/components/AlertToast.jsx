import { useEffect } from 'react';

export default function AlertToast({ icon, text, sub, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div className={`alert-toast ${type === 'sos' ? 'sos' : ''}`} onClick={onClose}>
      <div className="a-icon">{icon}</div>
      <div>
        <div className="a-text">{text}</div>
        {sub && <div className="a-sub">{sub}</div>}
      </div>
    </div>
  );
}