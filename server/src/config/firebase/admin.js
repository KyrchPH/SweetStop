import admin from "firebase-admin";

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

export default admin;
