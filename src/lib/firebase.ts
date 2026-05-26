import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, addDoc, deleteDoc, getDocs, orderBy, query, onSnapshot, where } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function syncUserXP(uid: string, email: string, displayName?: string | null, photoURL?: string | null) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  const profileData = {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    photoURL: photoURL || null,
    updatedAt: new Date().toISOString()
  };

  if (!userSnap.exists()) {
    const newUser = {
      ...profileData,
      xp: 0,
      hiddenFromLeaderboard: false
    };
    await setDoc(userRef, newUser);
    return newUser;
  }
  
  // Update profile info but keep XP and hidden status
  await setDoc(userRef, profileData, { merge: true });
  const finalSnap = await getDoc(userRef);
  return finalSnap.data();
}

export async function addXP(uid: string, amount: number) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    xp: increment(amount),
    updatedAt: new Date().toISOString()
  });
}

export async function updatePrivacySettings(uid: string, hidden: boolean) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    hiddenFromLeaderboard: hidden
  });
}

export async function getAllUsers() {
  const usersRef = collection(db, 'users');
  const querySnapshot = await getDocs(usersRef);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];
}

export async function getLeaderboard() {
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef, 
    orderBy('xp', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const allUsers = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];
  
  return allUsers.filter(u => !u.hiddenFromLeaderboard && u.displayName !== 'Pixel Yoonie');
}

export async function addTaskToDB(uid: string, text: string, rarity: string) {
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const docRef = await addDoc(tasksRef, {
    text,
    rarity,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function removeTaskFromDB(uid: string, taskId: string) {
  const taskRef = doc(db, 'users', uid, 'tasks', taskId);
  await deleteDoc(taskRef);
}

export function subscribeToTasks(uid: string, callback: (tasks: any[]) => void) {
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const q = query(tasksRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(tasks);
  });
}
