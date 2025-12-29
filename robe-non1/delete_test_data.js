
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');
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
        const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/customer_records`));

        let deleteCount = 0;
        const deletedRecords = [];

        for (const recordDoc of querySnapshot.docs) {
            const data = recordDoc.data();
            const id = recordDoc.id;

            // Delete if name is '1' or '테스트' OR salesperson is '111' or '테스트'
            const shouldDelete =
                data.customerName === '1' ||
                data.customerName === '테스트' ||
                data.salesperson === '111' ||
                data.salesperson === '테스트' ||
                data.dbCreator === '111';

            if (shouldDelete) {
                const docRef = doc(db, `artifacts/${appId}/public/data/customer_records`, id);
                await deleteDoc(docRef);
                deleteCount++;
                deletedRecords.push({ id, name: data.customerName, salesperson: data.salesperson });
            }
        }

        console.log(`Successfully deleted ${deleteCount} records.`);
        console.log("Deleted Details:", JSON.stringify(deletedRecords, null, 2));

        process.exit(0);
    } catch (e) {
        console.error("Cleanup failed:", e);
        process.exit(1);
    }
}

cleanup();
