import { Document } from "mongoose";

export type CreditorsWatchContactType = {
    id?: number;
    external_id: string;
    name: string;
    email: string;
    status: string;
    registration_number: string;
    tax_number: string;
    phone_number: string;
    mobile_number: string;
    created_at?: string;
    updated_at?: string;
};

export type MappingType = {
    _id?: string,
    simproId: string;
    creditorsWatchId: string;
    lastSyncedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IMapping extends Document {
    simproId: string;
    creditorsWatchId: string;
    lastSyncedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type PaymentInfoType = {
    paymentDate: string;
    paymentInvoiceAmount: number;
    lateFeeOnPayment?: number;
};

export type CreditorsWatchInvoiceType = {
    id?: number;
    external_id: string,
    external_contact_id: string,
    status: string,
    invoice_number: string,
    currency_code: string,
    currency_rate: string,
    amount_due: number,
    amount_paid: number,
    total_amount: number,
    invoice_date: string,
    due_date: string,
    paid_date: string | null,
    LatePaymentFee?: boolean,
    payments?: PaymentInfoType[],
}




export type CreditorsWatchCreditNoteType = {
    id?: number;
    amount_remaining: number;
    credit_note_number: string;
    currency_code: string;
    currency_rate: string;
    date: string;
    external_contact_id: string;
    external_id: string;
    status: string;
    total_amount: number;
}


export type InvoiceItemPaymentsType = {
    paymentId: number;
    paymentDate: string;
    financeCharge: number;
    paymentInvoiceId: number;
    paymentInvoiceAmount: number;
}


