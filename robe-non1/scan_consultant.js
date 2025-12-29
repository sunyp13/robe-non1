const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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

async function scan() {
    try {
        await signInAnonymously(auth);
        const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/customer_records`));
        const impacted = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.consultant) {
                impacted.push({
                    id: doc.id,
                    customerName: data.customerName,
                    consultant: data.consultant,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : 'Unknown'
                });
            }
        });
        console.log(JSON.stringify(impacted, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

scan();
