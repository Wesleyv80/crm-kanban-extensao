import { initializeApp } from './firebase-app.js';
import { getFirestore, doc, setDoc, getDoc } from './firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDk-643eHhb0kEmyP8wB8yG4TyhH1d-DeM",
    authDomain: "crm-kanban-whatsapp.firebaseapp.com",
    projectId: "crm-kanban-whatsapp",
    storageBucket: "crm-kanban-whatsapp.firebasestorage.app",
    messagingSenderId: "534541515790",
    appId: "1:534541515790:web:0d8f384f585becf616d05f"
};

try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log("Firebase inicializado com sucesso no background!");

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "salvarDados") {
            setDoc(doc(db, "crm", request.uid), request.data)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
        } else if (request.action === "carregarDados") {
            getDoc(doc(db, "crm", request.uid))
                .then(snap => sendResponse(snap.exists() ? snap.data() : {}))
                .catch(error => sendResponse({ success: false, error: error.message }));
        }
        return true; // Essencial para respostas assíncronas
    });

} catch (e) {
    console.error("Erro CRÍTICO ao inicializar o Firebase no background:", e);
}