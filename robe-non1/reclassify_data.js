const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');

const firebaseConfig = {
    apiKey: "AIzaSyDIC0be4A6AK3lDjH5ouh_oywGvTKRxMt4",
    authDomain: "robe-non1.firebaseapp.com",
    projectId: "robe-non1",
    storageBucket: "robe-non1.firebasestorage.app",
    messagingSenderId: "491977372291",
    appId: "1:491977372291:web:8abd59846cc674689a61b6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = firebaseConfig.appId;

async function reclassify() {
    try {
        await signInAnonymously(auth);
        console.log("Authenticated.");

        const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/customer_records`));
        let count = 0;

        for (const d of querySnapshot.docs) {
            const data = d.data();
            const recordRef = doc(db, `artifacts/${appId}/public/data/customer_records`, d.id);
            let updates = {};

            // Rule: Legacy data (unclosed_records)
            if (data.migratedFrom === 'unclosed_records') {
                // 1. Should never be '대기'
                if (data.status === '대기' || !data.status) {
                    updates.status = '미계약';
                    updates.isRecovery = false;
                }
                // 2. '계약' in legacy must be recovery
                if (data.status === '계약' && !data.isRecovery) {
                    updates.isRecovery = true;
                }
            }

            // Rule: Handle recontracted status generally (just in case)
            if (data.status === 'recontracted') {
                updates.status = '계약';
                updates.isRecovery = true;
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(recordRef, updates);
                count++;
                console.log(`Reclassified [${d.id}]:`, updates);
            }
        }

        console.log(`Reclassification complete. Total records updated: ${count}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

reclassify();
