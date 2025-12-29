
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
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

        let targetRecords = [];
        const targetIds = [
            "5n2CtTQPlx25akVB1ODH", // 박도하
            "70d27EbBwDsjteilzcAK", // 김민식/이하은
            "F0SuLWPGQvne6hu92W4t", // 강영훈
            "Lx4M2GVLgSIyKO7t1M7W", // 테스트
            "MyswtvpNz4pKFqLm0rTp", // 이창렬/이지은
            "cp62P4EjHabwMc32EphD", // 박재훈/김다린
            "lUkRiSHo7qrl1bv4saPv", // 이정우 / 김지수
            "u5ACDHkretazqb2ZOum6"  // 1
        ];

        querySnapshot.forEach((doc) => {
            if (targetIds.includes(doc.id)) {
                const data = doc.data();
                targetRecords.push({
                    id: doc.id,
                    customerName: data.customerName,
                    salesperson: data.salesperson,
                    consultant: data.consultant,
                    dbCreator: data.dbCreator,
                    tmPerson: data.tmPerson,
                    branch: data.branch,
                    source: data.source,
                    status: data.status,
                    memo: data.memo,
                    consultationContent: data.consultationContent,
                    recordContent: data.recordContent,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : 'Unknown'
                });
            }
        });

        console.log(JSON.stringify(targetRecords, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

scan();
