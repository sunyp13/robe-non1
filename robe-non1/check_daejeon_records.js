const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
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

async function checkDaejeon() {
    try {
        await signInAnonymously(auth);
        console.log("Searching for records with branch: '대전본점'...");

        const q = query(
            collection(db, `artifacts/${appId}/public/data/customer_records`),
            where("branch", "==", "대전본점")
        );

        const querySnapshot = await getDocs(q);

        const results = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            results.push({
                id: doc.id,
                customerName: data.customerName,
                branch: data.branch,
                status: data.status,
                reservationDate: data.reservationDate,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                migratedFrom: data.migratedFrom || 'new_dashboard'
            });
        });

        console.log(`Found ${results.length} records with '대전본점'.`);
        if (results.length > 0) {
            console.log("Sample Records:");
            console.log(JSON.stringify(results.slice(0, 10), null, 2));
        }

        process.exit(0);
    } catch (e) {
        console.error("Analysis failed:", e);
        process.exit(1);
    }
}

checkDaejeon();
