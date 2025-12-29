
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

        let literalMijijeong = [];
        let missingSalesperson = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;

            // 1. Literal "미지정" string
            if (data.salesperson === '미지정' || data.consultant === '미지정') {
                literalMijijeong.push({
                    id,
                    customerName: data.customerName,
                    salesperson: data.salesperson,
                    consultant: data.consultant,
                    status: data.status,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : 'Unknown'
                });
            }

            // 2. Missing or empty salesperson (which shows up as "미지정" in UI)
            if (!data.salesperson && !data.consultant) {
                missingSalesperson.push({
                    id,
                    customerName: data.customerName,
                    status: data.status,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : 'Unknown'
                });
            }
        });

        console.log("=== Records with literal '미지정' string ===");
        console.log(JSON.stringify(literalMijijeong, null, 2));

        console.log("\n=== Records with missing salesperson/consultant (shows as '미지정' in UI) ===");
        console.log("Count:", missingSalesperson.length);
        if (missingSalesperson.length > 0) {
            console.log("Samples:", JSON.stringify(missingSalesperson.slice(0, 10), null, 2));
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

scan();
