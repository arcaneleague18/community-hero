import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, where, doc, updateDoc, increment, arrayUnion, arrayRemove } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Complaint, User } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || "(default)");
export const auth = getAuth(app);
export const storage = getStorage(app);

/** Sign in anonymously. Returns the Firebase Auth UID. */
export const signInAnon = async (): Promise<string> => {
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
};

/** Returns a promise that resolves with the current auth UID once auth state is ready. */
export const waitForAuth = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user ? user.uid : null);
    });
  });
};

/** Authenticated fetch wrapper that automatically attaches Firebase ID token in Authorization header */
export const authFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let token: string | null = null;
  if (!auth.currentUser) {
    try {
      await signInAnon();
    } catch (err) {
      console.warn("Could not sign in anonymously before fetch:", err);
    }
  }

  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch (err) {
      console.warn("Failed to retrieve ID token:", err);
    }
  }

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers
  });
};

/**
 * Uploads a base64 / data-URL media string to Firebase Storage under complaints/{userId}/.
 * Returns the public download URL.
 */
export const uploadComplaintMedia = async (dataUrl: string, userId: string): Promise<string> => {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  const contentType = match ? match[1] : (dataUrl.startsWith('data:video') ? 'video/mp4' : 'image/jpeg');
  const ext = contentType.split('/')[1] || 'jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const storagePath = `complaints/${userId}/${filename}`;
  
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, dataUrl, 'data_url', {
    contentType
  });

  return getDownloadURL(storageRef);
};

export const addComplaint = async (data: any) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Not authenticated");

  let imageUrl: string | undefined = data.imageUrl;
  let imageBase64: string | undefined = data.imageBase64;

  // Offload raw base64 to Firebase Storage to stay well below 1 MiB Firestore document limit
  if (imageBase64 && !imageUrl) {
    try {
      imageUrl = await uploadComplaintMedia(imageBase64, currentUser.uid);
      imageBase64 = undefined; // Omit heavy base64 from Firestore
    } catch (storageErr) {
      console.warn("Firebase Storage upload failed, falling back to base64:", storageErr);
    }
  }

  const complaintsRef = collection(db, "complaints");
  const docData: any = {
    ...data,
    userId: currentUser.uid,
    createdAt: serverTimestamp(),
    status: 'Pending'
  };

  if (imageUrl) {
    docData.imageUrl = imageUrl;
    delete docData.imageBase64;
  } else if (imageBase64) {
    docData.imageBase64 = imageBase64;
  }

  return addDoc(complaintsRef, docData);
};

export const getComplaints = async (): Promise<Complaint[]> => {
  const complaintsRef = collection(db, "complaints");
  const q = query(complaintsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Complaint[];
};

export const updateComplaintStatus = async (id: string, status: string, assignedTo?: string, userId?: string, rejectionReason?: string) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const { getDoc } = await import("firebase/firestore");
  const complaintRef = doc(db, "complaints", id);
  const data: any = { status };
  if (assignedTo) {
    data.assignedTo = assignedTo;
  }
  if (userId) {
    data.statusUpdatedBy = arrayUnion(userId);
  }
  if (status === 'Rejected' && rejectionReason) {
    data.rejectionReason = rejectionReason;
  }
  
  // Penalize user if rejected
  if (status === 'Rejected') {
    const docSnap = await getDoc(complaintRef);
    if (docSnap.exists()) {
      const complaintData = docSnap.data() as Complaint;
      if (complaintData.userId) {
        await awardPoints(complaintData.userId, -10, rejectionReason ? `Report rejected: ${rejectionReason}` : "Report rejected"); // Deduct 10 points for rejected reports
      }
    }
  }

  return updateDoc(complaintRef, data);
};

export const toggleUpvoteComplaint = async (id: string, _userId: string, hasUpvoted: boolean) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const userId = auth.currentUser.uid; // Use auth UID, ignore caller-supplied value
  const { getDoc } = await import("firebase/firestore");
  const complaintRef = doc(db, "complaints", id);
  
  const docSnap = await getDoc(complaintRef);
  let reporterId = null;
  if (docSnap.exists()) {
    reporterId = (docSnap.data() as any).userId;
  }

  if (hasUpvoted) {
    await updateDoc(complaintRef, {
      upvotedBy: arrayRemove(userId)
    });
    if (reporterId) {
      await awardPoints(reporterId, -5, "Someone removed their upvote from your report");
    }
  } else {
    await updateDoc(complaintRef, {
      upvotedBy: arrayUnion(userId)
    });
    if (reporterId) {
      await awardPoints(reporterId, 5, "Someone upvoted your report");
    }
  }
};

// Gamification & Users
export const createUser = async (user: any) => {
  const { setDoc } = await import("firebase/firestore");
  const userRef = doc(db, "users", user.id);
  await setDoc(userRef, user, { merge: true });
};

export const getUser = async (id: string): Promise<User | null> => {
  const { getDoc } = await import("firebase/firestore");
  const userRef = doc(db, "users", id);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as User;
  }
  return null;
};

export const getLeaderboard = async () => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("points", "desc"));
  const querySnapshot = await getDocs(q);
  const allUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return allUsers.filter((u: any) => u.role === 'Citizen');
};

export const getAllUsers = async (): Promise<User[]> => {
  const usersRef = collection(db, "users");
  const querySnapshot = await getDocs(usersRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

export const updateUserRole = async (userId: string, role: string) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { role });
};

export const deleteUser = async (userId: string) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const { deleteDoc } = await import("firebase/firestore");
  const userRef = doc(db, "users", userId);
  await deleteDoc(userRef);
};

export const awardPoints = async (userId: string, points: number, reason: string = "Awarded points") => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const userRef = doc(db, "users", userId);
  
  const { getDoc } = await import("firebase/firestore");
  const docSnap = await getDoc(userRef);
  
  if (docSnap.exists()) {
    const userData = docSnap.data();
    if (userData.role !== 'Citizen') return; // Only Citizens participate in impact

    const currentPoints = userData.points || 0;
    const newPoints = currentPoints + points;
    
    // Check for badges
    const newBadges = [...(userData.badges || [])];
    if (newPoints >= 50 && !newBadges.includes("Active Citizen")) {
      newBadges.push("Active Citizen");
    }
    if (newPoints >= 100 && !newBadges.includes("Community Hero")) {
      newBadges.push("Community Hero");
    }

    const historyEntry = {
      amount: points,
      reason,
      date: new Date().toISOString()
    };

    await updateDoc(userRef, {
      points: increment(points),
      badges: newBadges,
      pointsHistory: arrayUnion(historyEntry)
    });
  }
};
