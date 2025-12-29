const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, updateDoc } = require('firebase/firestore');
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

async function migrateWaiting() {
    try {
        await signInAnonymously(auth);
        console.log("Authenticated.");

        const q = query(collection(db, `artifacts/${appId}/public/data/customer_records`), where("status", "==", "대기"));
        const querySnapshot = await getDocs(q);

        let count = 0;
        for (const d of querySnapshot.docs) {
            const data = d.data();
            const recordRef = doc(db, `artifacts/${appId}/public/data/customer_records`, d.id);

            // Move status to '미계약' and copy memo to recordContent for better compatibility with legacy detail view
            await updateDoc(recordRef, {
                status: '미계약',
                recordContent: data.recordContent || data.memo || '',
                updatedBy: 'system_migration_waiting_to_uncontracted',
                updatedAt: new Date()
            });
            count++;
            console.log(`Migrated [${d.id}]: ${data.customerName} -> 미계약`);
        }

        console.log(`Migration complete. Total records moved: ${count}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrateWaiting();
