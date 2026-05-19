import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, addDoc, deleteDoc, getDocs, orderBy, query, onSnapshot } from 'firebase/firestore';
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

export async function syncUserXP(uid: string, email: string) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid,
      email,
      xp: 0,
      updatedAt: new Date().toISOString()
    });
    return 0;
  }
  
  return userSnap.data().xp as number;
}

export async function addXP(uid: string, amount: number) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    xp: increment(amount),
    updatedAt: new Date().toISOString()
  });
}

export async function addTaskToDB(uid: string, text: string) {
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const docRef = await addDoc(tasksRef, {
    text,
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
