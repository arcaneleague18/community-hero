import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, where, doc, updateDoc, increment, arrayUnion, arrayRemove } from "firebase/firestore";
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

export const addComplaint = async (data: any) => {
  const complaintsRef = collection(db, "complaints");
  return addDoc(complaintsRef, {
    ...data,
    createdAt: serverTimestamp(),
    status: 'Pending'
  });
};

export const getComplaints = async (): Promise<Complaint[]> => {
  const complaintsRef = collection(db, "complaints");
  const q = query(complaintsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Complaint[];
};

export const updateComplaintStatus = async (id: string, status: string, assignedTo?: string, userId?: string, rejectionReason?: string) => {
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

export const toggleUpvoteComplaint = async (id: string, userId: string, hasUpvoted: boolean) => {
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
  const userRef = doc(db, "users", user.id);
  await updateDoc(userRef, user).catch(async () => {
    // Fallback to create if doesn't exist
    const { setDoc } = await import("firebase/firestore");
    await setDoc(userRef, user);
  });
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
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { role });
};

export const deleteUser = async (userId: string) => {
  const { deleteDoc } = await import("firebase/firestore");
  const userRef = doc(db, "users", userId);
  await deleteDoc(userRef);
};

export const awardPoints = async (userId: string, points: number, reason: string = "Awarded points") => {
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
