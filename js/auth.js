// js/auth.js
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "./firebase.js";

// Register user → create Firebase auth user and Firestore doc (pending role)
export async function register(email, password, name = "") {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    
    // Create user document in Firestore
    await setDoc(doc(db, "Users", uid), {
      email,
      name: name.trim() || "",
      role: "pending",
      approved: false,
      photoURL: "", // Add photoURL field
      createdAt: Date.now()
    });
    
    alert("Registration successful! Waiting for admin approval.");
    location.href = "login.html";
  } catch (err) {
    console.error("Registration error:", err);
    alert("Registration failed: " + err.message);
  }
}

// Login
export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    
    // Check if approved
    const user = auth.currentUser;
    if (user) {
      const userDoc = await getDoc(doc(db, "Users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === "pending" || !userData.approved) {
          alert("Your account is pending admin approval.");
          await signOut(auth);
          return;
        }
      }
    }
    
    location.href = "profile.html";
  } catch (err) {
    console.error("Login error:", err);
    alert("Login failed: " + err.message);
  }
}

// Logout
export async function logout() {
  try {
    await signOut(auth);
    location.href = "index.html";
  } catch (err) {
    console.error("Logout error:", err);
    alert("Logout failed: " + err.message);
  }
}

// Update user name
export async function updateUserName(newName) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }
    
    await updateDoc(doc(db, "Users", user.uid), {
      name: newName.trim()
    });
    
    return true;
  } catch (err) {
    console.error("Error updating name:", err);
    throw err;
  }
}

// Protect admin pages - check auth and admin role
export function protectAdminPage() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        alert("Please login to access admin panel.");
        location.href = "../login.html";
        reject("Not authenticated");
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, "Users", user.uid));
        if (!userDoc.exists()) {
          alert("User profile not found.");
          location.href = "../index.html";
          reject("No profile");
          return;
        }
        
        const userData = userDoc.data();
        if (userData.role !== "admin") {
          alert("Admin access required.");
          location.href = "../index.html";
          reject("Not admin");
          return;
        }
        
        resolve(userData);
      } catch (err) {
        console.error("Auth check error:", err);
        alert("Authentication error.");
        location.href = "../index.html";
        reject(err);
      }
    });
  });
}

// Get current user with profile data (promise-based)
export function getCurrentUser() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        resolve(null);
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, "Users", user.uid));
        if (userDoc.exists()) {
          resolve({ uid: user.uid, email: user.email, ...userDoc.data() });
        } else {
          resolve({ uid: user.uid, email: user.email, role: "pending" });
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        resolve({ uid: user.uid, email: user.email, role: "pending" });
      }
    });
  });
}

// Helper: listen to auth state changes with callback
export function onAuthState(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    
    try {
      const userDoc = await getDoc(doc(db, "Users", user.uid));
      if (userDoc.exists()) {
        callback({ uid: user.uid, email: user.email, ...userDoc.data() });
      } else {
        callback({ uid: user.uid, email: user.email, role: "pending" });
      }
    } catch (err) {
      console.error("Error in onAuthState:", err);
      callback({ uid: user.uid, email: user.email, role: "pending" });
    }
  });
}
