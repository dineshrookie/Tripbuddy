// src/firebase/locationService.js
import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "./config";
import { getCurrentUser } from "./authService";

// ─────────────────────────────────────────────────────────────
// Haversine distance formula (returns km)
// ─────────────────────────────────────────────────────────────
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate distances from one rider to all others.
 * Returns array sorted by distance ascending.
 */
export function calcDistances(myLat, myLng, allRiders, myUserId) {
  return allRiders
    .filter((r) => r.userId !== myUserId && r.lat && r.lng)
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      distanceKm: parseFloat(haversine(myLat, myLng, r.lat, r.lng).toFixed(3)),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Find nearest rider to a position (for SOS)
 */
export function findNearest(lat, lng, riders, myUserId) {
  let nearest = null;
  let minDist = Infinity;
  for (const r of riders) {
    if (r.userId === myUserId || !r.lat || !r.lng) continue;
    const d = haversine(lat, lng, r.lat, r.lng);
    if (d < minDist) {
      minDist = d;
      nearest = { ...r, distanceKm: parseFloat(d.toFixed(3)) };
    }
  }
  return nearest;
}

// ─────────────────────────────────────────────────────────────
// Push location update to Firestore
// Called every 5–10 seconds from useLocationTracker hook
// ─────────────────────────────────────────────────────────────
export async function pushLocation({
  tripId,
  lat,
  lng,
  speed,
  heading,
  accuracy,
  userName,
  prevLat,
  prevLng,
}) {
  const user = getCurrentUser();
  if (!user) return;

  const locRef = doc(db, "trips", tripId, "locations", user.uid);

  await setDoc(locRef, {
    lat,
    lng,
    speed: speed || 0,
    heading: heading || null,
    accuracy: accuracy || null,
    name: userName,
    updatedAt: serverTimestamp(),
  });

  // Accumulate distance on trip doc if rider has moved > 10m
  if (prevLat && prevLng) {
    const delta = haversine(prevLat, prevLng, lat, lng);
    if (delta > 0.01) {
      updateDoc(doc(db, "trips", tripId), {
        [`memberDistances.${user.uid}`]: increment(delta),
      }).catch(() => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Trigger SOS — writes an event doc which other riders
// listen to via real-time snapshot
// ─────────────────────────────────────────────────────────────
export async function triggerSOS({ tripId, lat, lng, message, allRiders }) {
  const user = getCurrentUser();
  if (!user) return;

  const nearest = findNearest(lat, lng, allRiders, user.uid);

  await addDoc(collection(db, "trips", tripId, "events"), {
    type: "sos_triggered",
    userId: user.uid,
    lat,
    lng,
    message: message || null,
    nearestRider: nearest
      ? { userId: nearest.userId, name: nearest.name, distanceKm: nearest.distanceKm }
      : null,
    createdAt: serverTimestamp(),
  });

  // Also send browser notification to other members if permitted
  if (Notification.permission === "granted") {
    new Notification("🆘 SOS Alert", {
      body: `${user.displayName || "A rider"} triggered an emergency!`,
      icon: "/logo192.png",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Log a stop event
// Called by useStopDetection hook when stop is confirmed
// ─────────────────────────────────────────────────────────────
export async function logStopEvent({ tripId, lat, lng, durationMs, userName }) {
  const user = getCurrentUser();
  if (!user) return;

  await addDoc(collection(db, "trips", tripId, "events"), {
    type: "rider_stopped",
    userId: user.uid,
    userName,
    lat,
    lng,
    durationMs,
    createdAt: serverTimestamp(),
  });
}

export async function logResumeEvent({ tripId, lat, lng, userName }) {
  const user = getCurrentUser();
  if (!user) return;

  await addDoc(collection(db, "trips", tripId, "events"), {
    type: "rider_resumed",
    userId: user.uid,
    userName,
    lat,
    lng,
    createdAt: serverTimestamp(),
  });
}
