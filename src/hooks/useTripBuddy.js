// src/hooks/useTripBuddy.js
import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getCurrentUser } from "../firebase/authService";
import {
  pushLocation,
  logStopEvent,
  logResumeEvent,
  calcDistances,
} from "../firebase/locationService";

const LOCATION_INTERVAL_MS = 7000;   // push every 7 seconds
const SPEED_THRESHOLD_KMH  = 5;      // below this = stopped
const STOP_DURATION_MS     = 180000; // 3 minutes

// ─────────────────────────────────────────────────────────────
// useLocationTracker
// Starts GPS watchPosition, pushes to Firestore every 7s
// ─────────────────────────────────────────────────────────────
export function useLocationTracker(tripId, userName, isActive) {
  const [myLocation, setMyLocation] = useState(null);
  const [error, setError]           = useState(null);
  const prevLocRef                  = useRef(null);
  const lastPushRef                 = useRef(0);
  const watchIdRef                  = useRef(null);

  useEffect(() => {
    if (!isActive || !tripId) return;

    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, speed, heading, accuracy } = pos.coords;
        const speedKmh = speed != null ? speed * 3.6 : 0;

        const location = { lat, lng, speed: speedKmh, heading, accuracy };
        setMyLocation(location);

        // Throttle Firestore writes to every 7 seconds
        const now = Date.now();
        if (now - lastPushRef.current >= LOCATION_INTERVAL_MS) {
          lastPushRef.current = now;
          await pushLocation({
            tripId,
            lat,
            lng,
            speed: speedKmh,
            heading,
            accuracy,
            userName,
            prevLat: prevLocRef.current?.lat,
            prevLng: prevLocRef.current?.lng,
          });
          prevLocRef.current = { lat, lng };
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isActive, tripId, userName]);

  return { myLocation, locationError: error };
}

// ─────────────────────────────────────────────────────────────
// useStopDetection
// Monitors speed from myLocation, triggers stop event at 3 min
// ─────────────────────────────────────────────────────────────
export function useStopDetection(tripId, myLocation, userName) {
  const stopStartRef  = useRef(null);
  const notifiedRef   = useRef(false);

  useEffect(() => {
    if (!myLocation || !tripId) return;

    const { lat, lng, speed } = myLocation;
    const isSlow = speed < SPEED_THRESHOLD_KMH;

    if (isSlow) {
      if (!stopStartRef.current) {
        stopStartRef.current = Date.now();
        notifiedRef.current  = false;
      } else {
        const elapsed = Date.now() - stopStartRef.current;
        if (elapsed >= STOP_DURATION_MS && !notifiedRef.current) {
          notifiedRef.current = true;
          logStopEvent({ tripId, lat, lng, durationMs: elapsed, userName });

          // Browser notification
          if (Notification.permission === "granted") {
            new Notification("You've stopped", {
              body: "You have been stationary for 3 minutes. Your team has been notified.",
            });
          }
        }
      }
    } else {
      if (stopStartRef.current) {
        const wasNotified = notifiedRef.current;
        stopStartRef.current = null;
        notifiedRef.current  = false;
        if (wasNotified) {
          logResumeEvent({ tripId, lat, lng, userName });
        }
      }
    }
  }, [myLocation, tripId, userName]);
}

// ─────────────────────────────────────────────────────────────
// useTripListeners
// Real-time listeners for:
//   - All rider locations
//   - Trip events (stops, SOS, joins)
//   - Trip document (status changes)
// ─────────────────────────────────────────────────────────────
export function useTripListeners(tripId) {
  const [riders,    setRiders]    = useState([]);
  const [events,    setEvents]    = useState([]);
  const [trip,      setTrip]      = useState(null);
  const [distances, setDistances] = useState([]);

  const user = getCurrentUser();

  // Listen to all rider locations
  useEffect(() => {
    if (!tripId) return;

    const unsub = onSnapshot(
      collection(db, "trips", tripId, "locations"),
      (snap) => {
        const updatedRiders = snap.docs.map((d) => ({
          userId: d.id,
          ...d.data(),
        }));
        setRiders(updatedRiders);

        // Recalculate distances from me to others
        if (user) {
          const me = updatedRiders.find((r) => r.userId === user.uid);
          if (me?.lat && me?.lng) {
            setDistances(calcDistances(me.lat, me.lng, updatedRiders, user.uid));
          }
        }
      }
    );

    return unsub;
  }, [tripId]);

  // Listen to trip events (last 20, newest first)
  useEffect(() => {
    if (!tripId) return;

    const unsub = onSnapshot(
      query(
        collection(db, "trips", tripId, "events"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const newEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEvents(newEvents);
      }
    );

    return unsub;
  }, [tripId]);

  // Listen to trip doc (status, summary)
  useEffect(() => {
    if (!tripId) return;

    const unsub = onSnapshot(doc(db, "trips", tripId), (snap) => {
      if (snap.exists()) setTrip({ tripId: snap.id, ...snap.data() });
    });

    return unsub;
  }, [tripId]);

  // Extract specific event types for easy consumption in UI
  const sosEvents    = events.filter((e) => e.type === "sos_triggered");
  const stopEvents   = events.filter((e) => e.type === "rider_stopped");
  const latestSOS    = sosEvents[0] || null;
  const latestStop   = stopEvents[0] || null;

  return { riders, events, trip, distances, latestSOS, latestStop };
}

// ─────────────────────────────────────────────────────────────
// useNotificationPermission
// Request browser notification permission on mount
// ─────────────────────────────────────────────────────────────
export function useNotificationPermission() {
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);
}
