import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const q = query(
      collection(db, 'users'), 
      where('hiddenFromLeaderboard', '==', false),
      orderBy('xp', 'desc')
    );
    const snap = await getDocs(q);
    console.log('Success! Docs:', snap.docs.length);
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
test();
