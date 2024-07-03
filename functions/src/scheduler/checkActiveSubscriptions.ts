import {
  BusinessSubscriptionStatus,
  FireStoreBusinessFields,
  FireStoreCollections,
  SpecialTransactionStatus,
} from "../types";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export default async function checkActiveSubscriptions() {
  //First we get all the business with subscription_status = active
  const businessesWithActiveSubscription = await admin
    .firestore()
    .collection(FireStoreCollections.business)
    .where(
      FireStoreBusinessFields.subscription_status,
      "==",
      BusinessSubscriptionStatus.active
    )
    .get();

  if (businessesWithActiveSubscription.empty) {
    return;
  }

  //For each business we check if the last transaction is expired
  businessesWithActiveSubscription.forEach(async (business) => {
    const latestTransactionDocumentId = business.data().latest_transaction;

    //We disable the business if it has no latest_transaction
    if (!latestTransactionDocumentId) {
      const documentToUpdate = admin
        .firestore()
        .collection(FireStoreCollections.business)
        .doc(business.id);

      documentToUpdate.update({
        subscription_status: BusinessSubscriptionStatus.inactive,
        status: BusinessSubscriptionStatus.inactive,
      });
      return;
    }

    //If the latest transaction is no_subscription_business we leave the business as active
    if (
      latestTransactionDocumentId ==
      SpecialTransactionStatus.no_subscription_business
    ) {
      return;
    }

    const latestTransaction = await admin
      .firestore()
      .collection(FireStoreCollections.business_transactions)
      .doc(latestTransactionDocumentId)
      .get();

    if (!latestTransaction.exists) {
      return;
    }

    const latestTransactionData = latestTransaction.data();
    const latestTransactionExpirationDate =
      latestTransactionData?.expiration_date as Timestamp;

    //If the transaction is expired we update the business subscription status to
    if (latestTransactionExpirationDate.toMillis() < Date.now()) {
      const businessToEdit = admin
        .firestore()
        .collection(FireStoreCollections.business)
        .doc(business.id);

      businessToEdit.update({
        subscription_status: BusinessSubscriptionStatus.canceled,
        status: BusinessSubscriptionStatus.inactive,
      });
    }
  });
}
