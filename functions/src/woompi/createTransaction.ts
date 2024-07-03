// Helpers
import {
  createEmptyDocument,
  deleteDocument,
  updateDocumentData,
  updateDocumentPropertyByDocumentId,
} from "../helpers/firebase_helpers";
import { sendDataToWompi } from "../helpers/network_helpers";

// Constants
import {
  BASEWOOMPIURL,
  BUSINESSCOLLECTION,
  PLAN1,
  PLAN1COST,
  PLAN2,
  PLAN2COST,
  PLAN3,
  PLAN3COST,
  TRANSACTIONSCOLLECTION,
  TRANSACTIONURL,
} from "../constants/app_constants";

// Types
import {
  BusinessSubscriptionStatus,
  TransactionErrorResponse,
  TransactionRequestBody,
  WoompiTransactionStatus,
} from "../types";

// Libraries
import { Request } from "express";
import moment from "moment";
import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";

export default async function createWoompiTransaction(request: Request) {
  //First we create a document in the collection business_transactions
  const newDocumentId = await createEmptyDocument(TRANSACTIONSCOLLECTION);

  //Get the amount in cents
  const amountInCents = getAmountByPlan(request.body.plan);
  if (amountInCents === null) {
    return "Invalid plan";
  }

  const integritySignature = await createSignature(
    newDocumentId,
    amountInCents
  );

  //Create the transaction body
  const transactionBody: TransactionRequestBody = {
    amount_in_cents: amountInCents,
    currency: "COP",
    signature: integritySignature,
    customer_email: request.body.customerEmail,
    payment_method: {
      installments: 1,
    },
    reference: newDocumentId,
    payment_source_id: request.body.paymentMethodId,
  };

  //Create the payment method
  const transactionResponseJson = await sendDataToWompi(
    BASEWOOMPIURL + TRANSACTIONURL,
    transactionBody
  );

  if (transactionResponseJson.error) {
    //We delete the document if the transaction was not created
    await deleteDocument(TRANSACTIONSCOLLECTION, newDocumentId);
    return handleCreateErrorMessages(transactionResponseJson);
  }

  const expirationDate = getExpirationDateByPlan(request.body.plan);

  //Save the transaction in the database
  var dataBaseTransactionBody = {
    amount: amountInCents,
    customer_email: request.body.customerEmail,
    payment_method_id: request.body.paymentMethodId,
    plan: request.body.plan,
    reference: transactionResponseJson["data"]["reference"],
    status: transactionResponseJson["data"]["status"],
    business_id: request.body.businessId,
    created_at: Timestamp.fromDate(
      new Date(transactionResponseJson["data"]["created_at"])
    ),
    signature: integritySignature,
    id: transactionResponseJson["data"]["id"],
    expiration_date: Timestamp.fromDate(expirationDate),
  };

  await updateDocumentData(
    TRANSACTIONSCOLLECTION,
    newDocumentId,
    dataBaseTransactionBody
  );

  //Then we set the subscription status of the business id

  const businessStatus = getBusinessStatus(
    transactionResponseJson["data"]["status"]
  );
  if (businessStatus === null) {
    return "Invalid status: " + businessStatus;
  }
  await updateDocumentPropertyByDocumentId(
    BUSINESSCOLLECTION,
    request.body.businessId,
    "subscription_status",
    businessStatus
  );

  await updateDocumentPropertyByDocumentId(
    BUSINESSCOLLECTION,
    request.body.businessId,
    "latest_transaction",
    newDocumentId
  );
  return null;
}

async function createSignature(
  documentReference: string,
  amountInCents: number
) {
  const signature = "test_integrity_siZIeprkFUMVf14SV2UDQ8PJj0nmThSN";
  const integrationString = `${documentReference}${amountInCents}COP${signature}`;

  const encondedText = new TextEncoder().encode(integrationString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encondedText);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

function getAmountByPlan(plan: string): number | null {
  switch (plan) {
    case PLAN1:
      return PLAN1COST;
    case PLAN2:
      return PLAN2COST;
    case PLAN3:
      return PLAN3COST;
    default:
      return null;
  }
}

function getExpirationDateByPlan(plan: string): Date {
  const currentDate = new Date();
  switch (plan) {
    case PLAN1:
      return moment(currentDate).add(1, "months").toDate();
    case PLAN2:
      return moment(currentDate).add(3, "months").toDate();
    case PLAN3:
      return moment(currentDate).add(6, "months").toDate();
    default:
      return currentDate;
  }
}

function getBusinessStatus(status: string): string | null {
  switch (status) {
    case WoompiTransactionStatus.APPROVED:
      return BusinessSubscriptionStatus.active;
    case WoompiTransactionStatus.DECLINED:
      return BusinessSubscriptionStatus.inactive;
    case WoompiTransactionStatus.ERROR:
      return BusinessSubscriptionStatus.inactive;
    case WoompiTransactionStatus.VOIDED:
      return BusinessSubscriptionStatus.inactive;
    case WoompiTransactionStatus.PENDING:
      return BusinessSubscriptionStatus.pending;
    default:
      return null;
  }
}

function handleCreateErrorMessages(
  paymentResponseJson: TransactionErrorResponse
): string {
  const { error } = paymentResponseJson;
  if (!error || !error.messages) {
    return "No error messages available";
  }

  const { messages } = error;

  const amountError = messages.amount_in_cents?.[0] || "";
  const currencyError = messages.currency?.[0] || "";
  const signatureError = messages.signature?.[0] || "";
  const customerError = messages.customer_email?.[0] || "";
  const paymentMethodError = messages.payment_method?.[0] || "";
  const referenceError = messages.reference?.[0] || "";
  const paymentSourceError = messages.payment_source_id?.[0] || "";

  const errorMessages = `Error creando la transacción: ${amountError} ${currencyError} ${signatureError} ${customerError} ${paymentMethodError} ${referenceError} ${paymentSourceError}`;

  return errorMessages;
}
