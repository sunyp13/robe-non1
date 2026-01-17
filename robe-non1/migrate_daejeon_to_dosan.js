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

async function migrate() {
    try {
        await signInAnonymously(auth);
        console.log("Starting migration: '대전본점' -> '도산'...");

        const q = query(
            collection(db, `artifacts/${appId}/public/data/customer_records`),
            where("branch", "==", "대전본점")
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log("No records found with branch '대전본점'.");
            process.exit(0);
        }

        console.log(`Found ${querySnapshot.size} records to update.`);

        let updatedCount = 0;
        for (const recordDoc of querySnapshot.docs) {
            const recordRef = doc(db, `artifacts/${appId}/public/data/customer_records`, recordDoc.id);
            await updateDoc(recordRef, {
                branch: "도산",
                branchMigrationNote: "Migrated from 대전본점 by agent on 2026-01-14"
            });
            console.log(`Updated record ${recordDoc.id} (${recordDoc.data().customerName})`);
            updatedCount++;
        }

        console.log(`Migration complete. Total updated: ${updatedCount}`);
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

migrate();
