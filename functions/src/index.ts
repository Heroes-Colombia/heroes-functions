import { onRequest } from "firebase-functions/v1/https";

import * as admin from "firebase-admin";

import createWoompiPaymentMethod from "./woompi/createPaymentMethod";
import createWoompiTransaction from "./woompi/createTransaction";
import checkWoompiTransactionStatus from "./woompi/checkTransactionStatus";
import { setGlobalOptions } from "firebase-functions/v2/options";
import * as functions from "firebase-functions";

import express, { Express } from "express";
import cors from "cors";
// import checkActiveSubscriptions from "./scheduler/checkActiveSubscriptions";
import checkMarkToRenewSubscriptions from "./scheduler/checkMarkToRenewSubscriptions";
import checkActiveSubscriptions from "./scheduler/checkActiveSubscriptions";
import checkFreeTrialSubscriptions from "./scheduler/checkFreeTrialSubscriptions";

//Initialize the firebase admin on server start
admin.initializeApp();

setGlobalOptions({ maxInstances: 10 }); // set it here

const app: Express = express();
app.use(cors());
app.use(express.json());

app.get("/cloudFunctionStatus", async (request, response) => {
  //Shows a log to the cloud console
  console.error("Cloud functions working 200");
  response.status(200).send("Cloud functions working");
});

/**
 * Each route handle the request and response of the request.
 * First valdidate the request. Then calls the function that will handle the request.
 * This function will return a string with the error message or null
 * if the request was successful. Finally, the function will send the response to the user.
 */

//Create a payment method
app.post("/createPaymentMethod", async (request, response) => {
  try {
    //Check if the user sent the required data
    if (
      !request.body ||
      !request.body.selectedPaymentMethod ||
      !request.body.acceptanceToken ||
      !request.body.businessEmail
    ) {
      response.status(400).send("Missing required data");
      return;
    }

    const error = await createWoompiPaymentMethod(request);
    if (error === null) {
      response.status(201).send("Payment method created successfully");
    } else {
      response.status(400).send(error);
    }
  } catch (error: any) {
    const newError = error as any;

    response
      .status(500)
      .send("Try again later" + error + newError.message + newError.stack);
  }
});

//Create a transaction
app.post("/createTransaction", async (request, response) => {
  try {
    //Check if the user sent the required data
    if (
      !request.body ||
      !request.body.paymentMethodId ||
      !request.body.customerEmail ||
      !request.body.businessId ||
      !request.body.plan
    ) {
      response.status(400).send("Missing required data");
      return;
    }

    const error = await createWoompiTransaction(request);
    if (error === null) {
      response.status(201).send("Transaction created successfully");
    } else {
      response.status(400).send(error);
    }
  } catch (error) {
    const newError = error as any;
    response
      .status(500)
      .send("Try again later" + error + newError.message + newError.stack);
  }
});

//Check the status of a transaction
app.put("/checkTransactionStatus", async (request, response) => {
  try {
    //Check if the user sent the required data
    if (!request.body || !request.body.transactionId) {
      response.status(400).send("Missing required data");
      return;
    }

    const error = await checkWoompiTransactionStatus(request);
    if (error === null) {
      response.status(200).send("Transaction updated successfully");
    } else {
      response.status(400).send(error);
    }
  } catch (error) {
    const newError = error as any;
    response
      .status(500)
      .send("Try again later" + error + newError.message + newError.stack);
  }
});

app.get("/testForSchedule", async (request, response) => {
  //First we get all the business with subscription_status = active
  try {
    await checkActiveSubscriptions();
    //await checkMarkToRenewSubscriptions();
    //await checkFreeTrialSubscriptions();
    response.status(200).send("Ejecutado con éxito");
  } catch (error) {
    response.status(500).send("Error: " + error);
  }
});

app.post("/singleUserNotification", async (request, response) => {
  try {
    if (
      !request.body ||
      !request.body.deviceNotificationToken ||
      !request.body.title ||
      !request.body.body
    ) {
      response.status(400).send("Missing required data");
      return;
    }

    const message = {
      notification: {
        title: request.body.title,
        body: request.body.body,
      },
      token: request.body.deviceNotificationToken,
    };

    await admin.messaging().send(message);

    response.status(200).send("Notification sent");
  } catch (error) {
    response.status(500).send("Error: " + error);
  }
});

app.post("/multipleUsersNotification", async (request, response) => {
  try {
    if (
      !request.body ||
      !request.body.deviceNotificationTokens ||
      !request.body.title ||
      !request.body.body
    ) {
      response.status(400).send("Missing required data");
      return;
    }

    const message = {
      notification: {
        title: request.body.title,
        body: request.body.body,
      },
      tokens: request.body.deviceNotificationTokens,
    };

    await admin.messaging().sendEachForMulticast(message);

    response.status(200).send("Notification sent");
  } catch (error) {
    response.status(500).send("Error: " + error);
  }
});

app.post("/multipleUsersNotificationsWithTopic", async (request, response) => {
  try {
    if (
      !request.body ||
      !request.body.topic ||
      !request.body.title ||
      !request.body.body
    ) {
      response.status(400).send("Missing required data");
      return;
    }

    const message = {
      notification: {
        title: request.body.title,
        body: request.body.body,
      },
      topic: request.body.topic,
    };

    await admin.messaging().send(message);

    response.status(200).send("Notification sent");
  } catch (error) {
    response.status(500).send("Error: " + error);
  }
});

//Schedule a function to run at 00:00 every day
exports.checkBusinessSubscriptions = functions.pubsub
  .schedule("0 0 * * *")
  .timeZone("America/Mexico_City")
  .onRun(async (context: any) => {
    try {
      await checkActiveSubscriptions();
      await checkMarkToRenewSubscriptions();
      await checkFreeTrialSubscriptions();
    } catch (error) {
      console.log("Error: " + error);
    }
    return null;
  });

//Export the express app
exports.widgets = onRequest(app);
