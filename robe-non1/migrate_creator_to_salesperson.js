
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

async function migrate() {
    try {
        await signInAnonymously(auth);
        const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/customer_records`));

        let updateCount = 0;
        const updatedRecords = [];

        for (const recordDoc of querySnapshot.docs) {
            const data = recordDoc.data();

            // If salesperson is missing but dbCreator exists
            if (!data.salesperson && data.dbCreator) {
                const docRef = doc(db, `artifacts/${appId}/public/data/customer_records`, recordDoc.id);

                await updateDoc(docRef, {
                    salesperson: data.dbCreator
                });

                updateCount++;
                updatedRecords.push({
                    id: recordDoc.id,
                    customerName: data.customerName,
                    assignedSalesperson: data.dbCreator
                });
            }
        }

        console.log(`Successfully updated ${updateCount} records.`);
        console.log("Updated Details:", JSON.stringify(updatedRecords, null, 2));

        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

migrate();
