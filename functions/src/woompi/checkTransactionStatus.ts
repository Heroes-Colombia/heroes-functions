import { Request } from "express";

//Helpers
import { getDataFromWoompiWithParam } from "../helpers/network_helpers";

//Types
import {
  BASEWOOMPIURL,
  BUSINESSCOLLECTION,
  TRANSACTIONSCOLLECTION,
  TRANSACTIONURL,
} from "../constants/app_constants";
import {
  BusinessSubscriptionStatus,
  TransactionErrorResponse,
  WoompiTransactionStatus,
} from "../types";
import {
  getDocumentIdByParam,
  updateDocumentPropertyByDocumentId,
} from "../helpers/firebase_helpers";

//Use this method only with the latest transaction of business
export default async function checkWoompiTransactionStatus(request: Request) {
  //Get the transaction status
  const transactionResponseJson = await getDataFromWoompiWithParam(
    BASEWOOMPIURL + TRANSACTIONURL,
    request.body.transactionId
  );

  if (transactionResponseJson.error) {
    return handleCreateErrorMessages(transactionResponseJson);
  }

  //Save the transaction in the database
  const currentTransactionDocumentId = await getDocumentIdByParam(
    TRANSACTIONSCOLLECTION,
    "id",
    request.body.transactionId
  );

  if (!currentTransactionDocumentId) {
    return "La transacción no existe en la base de datos";
  }

  //Update the transaction in the database
  await updateDocumentPropertyByDocumentId(
    TRANSACTIONSCOLLECTION,
    currentTransactionDocumentId,
    "status",
    transactionResponseJson["data"]["status"]
  );

  //Obtain the business document id
  const currentBusinessDocumentId = await getDocumentIdByParam(
    BUSINESSCOLLECTION,
    "latest_transaction",
    currentTransactionDocumentId
  );

  //Then we set the subscription status of the business id
  const businessStatus = getBusinessStatus(
    transactionResponseJson["data"]["status"]
  );
  if (businessStatus === null) {
    return "Invalid status: " + status;
  }
  await updateDocumentPropertyByDocumentId(
    BUSINESSCOLLECTION,
    currentBusinessDocumentId,
    "subscription_status",
    businessStatus
  );

  return null;
}

function getBusinessStatus(status: WoompiTransactionStatus): string | null {
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

  if (!error) {
    return "No error messages available";
  }

  if (error.type) {
    const typeError = error.type || "";
    const reasonError = error.reason || "";

    const errorMessages = `No se encontró la transacción: ${typeError} ${reasonError}`;
    return errorMessages;
  }

  return (
    "Error not handled yet in the function checkWoompiTransactionStatus" +
    { error }.toString()
  );
}
