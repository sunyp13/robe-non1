const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
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

async function checkLegacyFields() {
    try {
        await signInAnonymously(auth);

        // Check a few records from unclosed_records (Legacy Source)
        const legacyRef = collection(db, `artifacts/${appId}/public/data/unclosed_records`);
        const snapshot = await getDocs(query(legacyRef, limit(5)));

        console.log("--- Legacy Records Sample ---");
        snapshot.forEach(doc => {
            console.log(`ID: ${doc.id}`);
            console.log("Fields:", Object.keys(doc.data()));
            console.log("Content Preview:", doc.data().recordContent ? "Has recordContent" : "No recordContent");
            console.log("ConsultationContent:", doc.data().consultationContent ? "Has consultationContent" : "No consultationContent");
            console.log("----------------------------");
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkLegacyFields();
