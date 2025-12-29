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

async function listWaiting() {
    try {
        await signInAnonymously(auth);

        const q = query(collection(db, `artifacts/${appId}/public/data/customer_records`), where("status", "==", "대기"));
        const querySnapshot = await getDocs(q);

        const waitingList = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            waitingList.push({
                customerName: data.customerName,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString('ko-KR') : (data.createdAt || 'Unknown')
            });
        });

        // Sort by date desc (though new dashboard entries might not have multiple days yet)
        waitingList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(JSON.stringify(waitingList, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listWaiting();
