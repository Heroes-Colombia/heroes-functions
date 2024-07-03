import {
  BusinessSubscriptionStatus,
  FireStoreBusinessFields,
  FireStoreCollections,
} from "../types";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import createWoompiTransaction from "../woompi/createTransaction";
import { Request } from "express";
import { ParamsDictionary } from "express-serve-static-core";

export default async function checkMarkToRenewSubscriptions() {
  //First we get all the business with subscription_status = active
  const businessesWithActiveSubscription = await admin
    .firestore()
    .collection(FireStoreCollections.business)
    .where(
      FireStoreBusinessFields.subscription_status,
      "==",
      BusinessSubscriptionStatus.markToRenew
    )
    .get();

  if (businessesWithActiveSubscription.empty) {
    return;
  }

  //For each business we check if the last transaction is expired
  businessesWithActiveSubscription.forEach(async (business) => {
    const latestTransactionDocumentId = business.data().latest_transaction;
    //TODO: Check if the latest transaction is expired
    if (!latestTransactionDocumentId) {
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

    //If the last transaction is expired we need to create a new transaction
    if (latestTransactionExpirationDate.toMillis() < Date.now()) {
      //First we get the business payment Method
      const businessAllPaymentMethod = await admin
        .firestore()
        .collection(FireStoreCollections.payment_methods)
        .where("business_id", "==", business.id)
        .get();

      //If the business has no payment methods we update the business subscription status to inactive
      if (businessAllPaymentMethod.empty) {
        const documentToUpdate = admin
          .firestore()
          .collection(FireStoreCollections.business)
          .doc(business.id);

        documentToUpdate.update({
          subscription_status: BusinessSubscriptionStatus.canceled,
          status: BusinessSubscriptionStatus.inactive,
        });
        return;
      }

      //We use the payment method that is marked as default if there is no default we use the first one
      let businessPaymentMethod;
      businessAllPaymentMethod.forEach((paymentMethod) => {
        if (paymentMethod.data().is_default) {
          businessPaymentMethod = paymentMethod;
        }
      });

      if (!businessPaymentMethod) {
        businessPaymentMethod = businessAllPaymentMethod.docs[0];
      }

      const businessPaymentMethodData = businessPaymentMethod.data();

      //We create the transaction
      const error = await createWoompiTransaction({
        body: {
          paymentMethodId: businessPaymentMethodData.payment_method_id,
          customerEmail: business.data().email,
          businessId: business.id,
          plan: latestTransactionData?.plan,
        },
      } as Request<ParamsDictionary>);
      if (error === null) {
        console.log("Transaction created successfully");
      } else {
        console.log("Error creating the transaction: ", error);
      }
    }
  });
}
