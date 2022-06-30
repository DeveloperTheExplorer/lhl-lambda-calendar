// Import the functions you need from the SDKs you need
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);


const firebaseConfig = {
    credential: cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
};

// Initialize Firebase
initializeApp(firebaseConfig);

const db = getFirestore();

module.exports = db