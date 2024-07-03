//Payment method types
export interface PaymentMethodRequestBody {
  type: string;
  token: string;
  customer_email: string;
  acceptance_token: string;
}

export interface ErrorMessages {
  customer_email: string[];
  token: string[];
  acceptance_token: string[];
}

export interface PaymentErrorResponse {
  error?: {
    messages: ErrorMessages;
    type: string;
    reason: string;
  };
}

// Transaction types
export interface TransactionRequestBody {
  amount_in_cents: number;
  currency: string;
  signature: string;
  customer_email: string;
  payment_method: {
    installments: number;
  };
  reference: string;
  payment_source_id: string;
}

export interface TransactionErrorMessages {
  amount_in_cents: string[];
  currency: string[];
  signature: string[];
  customer_email: string[];
  payment_method: string[];
  reference: string[];
  payment_source_id: string[];
}

export interface TransactionErrorResponse {
  error?: {
    messages: TransactionErrorMessages;
    type: string;
    reason: string;
  };
}

//Transaction statuses
export enum WoompiTransactionStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  DECLINED = "DECLINED",
  ERROR = "ERROR",
  VOIDED = "VOIDED",
}

export enum BusinessSubscriptionStatus {
  active = "active", //If the last transaction is not expired
  inactive = "inactive", //If the business has no transactions or the last transaction is expired
  pending = "pending", //If the business has a transaction but is not approved yet
  markToRenew = "markToRenew", //If the business wants to renew the subscription
  freeTrial = "freeTrial", //If the business is in the free trial period
  canceled = "canceled", //If the business has canceled the subscription or the business does not have a payment method
}

export enum FireStoreCollections {
  business = "businesses",
  business_transactions = "business_transactions",
  payment_methods = "payment_methods",
}

export enum FireStoreBusinessFields {
  subscription_status = "subscription_status",
  latest_transaction = "latest_transaction",
}

export enum SpecialTransactionStatus {
  no_subscription_business = "no_subscription_business",
}

export enum NotificationsTopics {
  business = "business",
  user = "user",
  discoverNearbyBusiness = "discoverNearbyBusiness",
  favoriteBusinessPromotion = "favoriteBusinessPromotion",
}
