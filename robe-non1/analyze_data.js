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

async function analyze() {
    try {
        await signInAnonymously(auth);

        const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/customer_records`));

        const stats = {
            total: 0,
            byOrigin: {
                'unclosed_records': { total: 0, status: {} },
                'new_dashboard': { total: 0, status: {} },
                'unknown': { total: 0, status: {} }
            },
            byStatus: {}
        };

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const origin = data.migratedFrom || 'new_dashboard';
            const status = data.status || 'unknown';

            stats.total++;

            // Stats by Status
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

            // Stats by Origin
            if (!stats.byOrigin[origin]) stats.byOrigin[origin] = { total: 0, status: {} };
            stats.byOrigin[origin].total++;
            stats.byOrigin[origin].status[status] = (stats.byOrigin[origin].status[status] || 0) + 1;
        });

        console.log(JSON.stringify(stats, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

analyze();
