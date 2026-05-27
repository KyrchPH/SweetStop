import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

import { firebaseApp } from "./client";

export async function uploadReportPdf({ blob, reportId, businessDate }) {
  const storage = getStorage(firebaseApp);
  const fileName = `reports/${businessDate}-${reportId}.pdf`;
  const fileRef = ref(storage, fileName);
  await uploadBytes(fileRef, blob, {
    contentType: "application/pdf"
  });
  return getDownloadURL(fileRef);
}
