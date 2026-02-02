import { getDb } from "../utils/firebase";

/* 
 This function is used to get a document from a firestore collection
 */
export async function getDocumentIdByParam(
  collection: string,
  paramName: string,
  valueToSerach: any
): Promise<string> {
  const db = getDb();
  const collectionRef = db.collection(collection);
  const query = collectionRef.where(paramName, "==", valueToSerach);
  const querySnapshot = await query.get();
  const documentId = querySnapshot.docs.map((doc) => doc.id)[0];
  return documentId;
}

/* 
  This function is used to set a property in a document from a firestore collection
*/
export async function updateDocumentPropertyByDocumentId(
  collection: string,
  documentId: string,
  property: string,
  value: any
): Promise<void> {
  const db = getDb();
  const collectionRef = db.collection(collection);
  const documentRef = collectionRef.doc(documentId);
  await documentRef.update({
    [property]: value,
  });
}

/* 
  This function is used to create a empty document in a firestore collection
*/
export async function createEmptyDocument(collection: string): Promise<string> {
  const db = getDb();
  const collectionRef = db.collection(collection);
  const newDocument = await collectionRef.add({});
  return newDocument.id;
}

/**
 * This function is used to delete a document from a firestore collection
 */
export async function deleteDocument(
  collection: string,
  documentId: string
): Promise<void> {
  const db = getDb();
  const collectionRef = db.collection(collection);
  const documentRef = collectionRef.doc(documentId);
  await documentRef.update({
    ["DELETED"]: true,
  });
}

export async function updateDocumentData(
  collection: string,
  documentId: string,
  data: any
): Promise<void> {
  const db = getDb();
  const collectionRef = db.collection(collection);
  const documentRef = collectionRef.doc(documentId);
  await documentRef.set(data);
}
