import { Request } from "express";

// Helpers
import {
  getDocumentIdByParam,
  updateDocumentPropertyByDocumentId,
} from "../helpers/firebase_helpers";
import { sendDataToWompi } from "../helpers/network_helpers";

// Constants
import {
  BASEWOOMPIURL,
  PAYMENTMETHODSCOLLECTION,
  PAYMENTSOURCEURL,
} from "../constants/app_constants";

// Types
import { PaymentErrorResponse, PaymentMethodRequestBody } from "../types";

export default async function createWoompiPaymentMethod(request: Request) {
  //Create the payment method body
  const paymentMethodBody: PaymentMethodRequestBody = {
    type: "CARD",
    token: request.body.selectedPaymentMethod,
    customer_email: request.body.businessEmail,
    acceptance_token: request.body.acceptanceToken,
  };

  //Create the payment method
  const paymentResponseJson = await sendDataToWompi(
    BASEWOOMPIURL + PAYMENTSOURCEURL,
    paymentMethodBody
  );

  if (paymentResponseJson.error) {
    return handleCreateErrorMessages(paymentResponseJson);
  }

  let paymentMethodId = paymentResponseJson["data"]["id"];

  //Save the payment method in the database
  const currentPaymentDocumentId = await getDocumentIdByParam(
    PAYMENTMETHODSCOLLECTION,
    "id",
    request.body.selectedPaymentMethod
  );

  //Update the payment
  await updateDocumentPropertyByDocumentId(
    PAYMENTMETHODSCOLLECTION,
    currentPaymentDocumentId,
    "payment_method_id",
    paymentMethodId
  );

  return null;
}

function handleCreateErrorMessages(
  paymentResponseJson: PaymentErrorResponse
): string {
  const { error } = paymentResponseJson;

  if (!error) {
    return "No error messages available";
  }

  if (error.messages) {
    const { messages } = error;

    const customerError = messages.customer_email?.[0] || "";
    const tokenError = messages.token?.[0] || "";
    const acceptanceTokenError = messages.acceptance_token?.[0] || "";
    const errorMessages = `Error creando el método de pago: ${customerError} ${tokenError} ${acceptanceTokenError}`;

    return errorMessages;
  }

  if (error.type) {
    const typeError = error.type || "";
    const reasonError = error.reason || "";

    const errorMessages = `Error creando el método de pago: ${typeError} ${reasonError}`;
    return errorMessages;
  }

  return (
    "Error not handled yet in the function createWoompiPaymentMethod" +
    { error }.toString()
  );
}
