const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
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

async function checkSettings() {
    try {
        await signInAnonymously(auth);
        console.log("Checking dashboard_settings for branches...");

        const docRef = doc(db, `artifacts/${appId}/public/data/dashboard_settings`, "branches");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log("Branches in Firestore:", JSON.stringify(docSnap.data().items, null, 2));
        } else {
            console.log("No branches document found in Firestore.");
        }

        process.exit(0);
    } catch (e) {
        console.error("Check failed:", e);
        process.exit(1);
    }
}

checkSettings();
