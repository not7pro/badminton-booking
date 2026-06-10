import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCws78LEwQXJe_Ktd-UYNXj15S0hMMg7xQ",
    authDomain: "slisr-official.firebaseapp.com",
    databaseURL: "https://slisr-official-default-rtdb.firebaseio.com",
    projectId: "slisr-official",
    storageBucket: "slisr-official.firebasestorage.app",
    messagingSenderId: "1000091265027",
    appId: "1:1000091265027:web:a85999d57d0576539a0636"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, push, onValue, remove };
