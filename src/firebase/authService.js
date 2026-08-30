// src/firebase/authService.js
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google (popup) — free, no billing required
 * Also creates/updates the user document in Firestore
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    await createOrUpdateUserDoc(user, user.displayName || "Rider");
    return { success: true, user };
  } catch (err) {
    // Handle popup closed by user
    if (err.code === "auth/popup-closed-by-user") {
      return { success: false, error: "Sign-in popup was closed." };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Sign in with email and password
 */
export async function loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await createOrUpdateUserDoc(result.user, result.user.displayName || "Rider");
    return { success: true, user: result.user };
  } catch (err) {
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
      return { success: false, error: "Invalid email or password." };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Sign up with email, password, and display name
 */
export async function signUpWithEmail(email, password, name) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    await createOrUpdateUserDoc(user, name || "Rider");
    return { success: true, user };
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      return { success: false, error: "This email is already registered. Try signing in." };
    }
    if (err.code === "auth/weak-password") {
      return { success: false, error: "Password must be at least 6 characters." };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Create or update user document in Firestore
 */
async function createOrUpdateUserDoc(user, name) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name: name || "Rider",
      email: user.email || null,
      photoURL: user.photoURL || null,
      fcmToken: null,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    });
  } else {
    await setDoc(
      userRef,
      { lastSeen: serverTimestamp() },
      { merge: true }
    );
  }
}

/**
 * Get current logged-in user
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Sign out
 */
export async function signOut() {
  await auth.signOut();
}
