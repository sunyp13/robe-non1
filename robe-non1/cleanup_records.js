const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, deleteDoc, deleteField } = require('firebase/firestore');
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

async function cleanup() {
    try {
        await signInAnonymously(auth);
        console.log("Authenticated anonymously.");

        const basePath = `artifacts/${appId}/public/data/customer_records`;

        // 1. Delete '가나다/가라다' test record
        const testRecordId = "ZebD5TpnSg9nWNYsJROA";
        await deleteDoc(doc(db, basePath, testRecordId));
        console.log(`Deleted test record: ${testRecordId}`);

        // 2. Unify fields for '최하영/홍지훈'
        const record1Id = "1fAWm1DTew0pWxb3O1HE";
        await updateDoc(doc(db, basePath, record1Id), {
            salesperson: "윤택상",
            consultant: deleteField()
        });
        console.log(`Updated record: ${record1Id} (최하영/홍지훈)`);

        // 3. Unify fields for '박현종'
        const record2Id = "Ee2415oHoBIUOf3ALADb";
        await updateDoc(doc(db, basePath, record2Id), {
            salesperson: "임상돈",
            consultant: deleteField()
        });
        console.log(`Updated record: ${record2Id} (박현종)`);

        console.log("Cleanup complete!");
        process.exit(0);
    } catch (e) {
        console.error("Cleanup error:", e);
        process.exit(1);
    }
}

cleanup();
