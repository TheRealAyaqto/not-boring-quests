import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function hideUser() {
  try {
    const q = query(collection(db, 'users'), where('displayName', '==', 'Pixel Yoonie'));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log('User not found.');
      return;
    }
    for (const d of snap.docs) {
      await updateDoc(doc(db, 'users', d.id), { hiddenFromLeaderboard: true });
      console.log('Hid user:', d.id);
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
hideUser();
