// src/firebase/tripService.js
import {
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./config";
import { getCurrentUser } from "./authService";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateTripCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TB";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function isCodeUnique(code) {
  const q = query(
    collection(db, "trips"),
    where("code", "==", code),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty;
}

// ─────────────────────────────────────────────────────────────
// Create Trip
// ─────────────────────────────────────────────────────────────
export async function createTrip({ name, destination, destinationLat, destinationLng }) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch user name from Firestore
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userName = userSnap.data()?.name || "Host";

  // Generate unique code
  let code;
  for (let i = 0; i < 5; i++) {
    code = generateTripCode();
    if (await isCodeUnique(code)) break;
  }

  const tripRef = doc(collection(db, "trips"));
  await setDoc(tripRef, {
    code,
    name: name.trim(),
    destination: destination.trim(),
    destinationLat: destinationLat || null,
    destinationLng: destinationLng || null,
    hostId: user.uid,
    hostName: userName,
    status: "waiting",
    memberIds: [user.uid],
    memberNames: { [user.uid]: userName },
    memberDistances: { [user.uid]: 0 },
    startedAt: null,
    endedAt: null,
    summary: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Log join event
  await addDoc(collection(db, "trips", tripRef.id, "events"), {
    type: "rider_joined",
    userId: user.uid,
    userName,
    role: "host",
    createdAt: serverTimestamp(),
  });

  return { tripId: tripRef.id, code };
}

// ─────────────────────────────────────────────────────────────
// Join Trip by code
// ─────────────────────────────────────────────────────────────
export async function joinTrip(code) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const q = query(
    collection(db, "trips"),
    where("code", "==", code.trim().toUpperCase()),
    limit(1)
  );
  const snap = await getDocs(q);

  if (snap.empty) throw new Error("Trip not found. Check the code.");

  const tripDoc = snap.docs[0];
  const tripData = tripDoc.data();

  if (tripData.status === "ended" || tripData.status === "cancelled") {
    throw new Error("This trip has already ended.");
  }

  const alreadyMember = (tripData.memberIds || []).includes(user.uid);

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userName = userSnap.data()?.name || "Rider";

  if (!alreadyMember) {
    await updateDoc(tripDoc.ref, {
      memberIds: arrayUnion(user.uid),
      [`memberNames.${user.uid}`]: userName,
      [`memberDistances.${user.uid}`]: 0,
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "trips", tripDoc.id, "events"), {
      type: "rider_joined",
      userId: user.uid,
      userName,
      role: "rider",
      createdAt: serverTimestamp(),
    });
  }

  return {
    tripId: tripDoc.id,
    ...tripData,
    isNew: !alreadyMember,
  };
}

// ─────────────────────────────────────────────────────────────
// Start Trip (host only)
// ─────────────────────────────────────────────────────────────
export async function startTrip(tripId) {
  const user = getCurrentUser();
  const tripRef = doc(db, "trips", tripId);
  const tripSnap = await getDoc(tripRef);

  if (!tripSnap.exists()) throw new Error("Trip not found.");
  if (tripSnap.data().hostId !== user.uid) throw new Error("Only host can start.");

  await updateDoc(tripRef, {
    status: "active",
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, "trips", tripId, "events"), {
    type: "trip_started",
    userId: user.uid,
    createdAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────
// End Trip (host only) — summary calculated here
// ─────────────────────────────────────────────────────────────
export async function endTrip(tripId) {
  const user = getCurrentUser();
  const tripRef = doc(db, "trips", tripId);
  const tripSnap = await getDoc(tripRef);

  if (!tripSnap.exists()) throw new Error("Trip not found.");
  const tripData = tripSnap.data();
  if (tripData.hostId !== user.uid) throw new Error("Only host can end the trip.");

  // Calculate summary from memberDistances already accumulated
  const startedAt = tripData.startedAt?.toMillis?.() || Date.now();
  const durationMinutes = Math.round((Date.now() - startedAt) / 60000);

  // Count stop events
  const eventsSnap = await getDocs(
    query(
      collection(db, "trips", tripId, "events"),
      where("type", "==", "rider_stopped")
    )
  );

  const riders = (tripData.memberIds || []).map((uid) => ({
    userId: uid,
    name: tripData.memberNames?.[uid] || "Rider",
    distanceKm: parseFloat((tripData.memberDistances?.[uid] || 0).toFixed(3)),
  }));

  const summary = {
    durationMinutes,
    stopCount: eventsSnap.size,
    riders,
    totalDistanceKm: parseFloat(
      riders.reduce((s, r) => s + r.distanceKm, 0).toFixed(3)
    ),
    generatedAt: new Date().toISOString(),
  };

  await updateDoc(tripRef, {
    status: "ended",
    endedAt: serverTimestamp(),
    summary,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, "trips", tripId, "events"), {
    type: "trip_ended",
    summary,
    createdAt: serverTimestamp(),
  });

  return summary;
}

// ─────────────────────────────────────────────────────────────
// Get trip details
// ─────────────────────────────────────────────────────────────
export async function getTrip(tripId) {
  const tripSnap = await getDoc(doc(db, "trips", tripId));
  if (!tripSnap.exists()) throw new Error("Trip not found.");
  return { tripId: tripSnap.id, ...tripSnap.data() };
}

// ─────────────────────────────────────────────────────────────
// Get user's past trips
// ─────────────────────────────────────────────────────────────
export async function getMyTrips() {
  const user = getCurrentUser();
  const q = query(
    collection(db, "trips"),
    where("memberIds", "array-contains", user.uid),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ tripId: d.id, ...d.data() }));
}
