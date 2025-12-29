const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, deleteField } = require('firebase/firestore');
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

async function migrateToTimeline() {
    try {
        await signInAnonymously(auth);
        console.log("Authenticated.");

        const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/customer_records`));
        let count = 0;

        for (const d of querySnapshot.docs) {
            const data = d.data();
            const recordRef = doc(db, `artifacts/${appId}/public/data/customer_records`, d.id);

            // If already has logs, skip or check if we need to add more
            if (data.consultationLogs && data.consultationLogs.length > 0) continue;

            let logs = [];

            // 1. Initial recordContent/memo
            const initialText = data.recordContent || data.memo || '';
            if (initialText) {
                logs.push({
                    id: "migration_initial_" + d.id,
                    text: initialText,
                    type: "기존 데이터 기반 기록",
                    createdAt: data.createdAt || data.date || new Date(),
                    createdBy: data.dbCreator || data.salesperson || "system"
                });
            }

            // 2. Consultation content if exists separately
            if (data.consultationContent && data.consultationContent !== initialText) {
                logs.push({
                    id: "migration_consult_" + d.id,
                    text: data.consultationContent,
                    type: "이전 상담 기록",
                    createdAt: data.consultationTime || data.updatedAt || new Date(),
                    createdBy: data.salesperson || "system"
                });
            }

            if (logs.length > 0) {
                await updateDoc(recordRef, {
                    consultationLogs: logs,
                    recordContent: logs[logs.length - 1].text, // Unified preview
                    memo: deleteField(),
                    consultationContent: deleteField()
                });
                count++;
                console.log(`Migrated [${d.id}]: ${data.customerName} (${logs.length} logs)`);
            }
        }

        console.log(`Migration complete. Total records updated: ${count}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrateToTimeline();
