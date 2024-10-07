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


export type SimproCompanyType = {
    ID: number;
    CompanyName: string;
    Email: string;
    Archived: boolean;
    EIN: string;
    Phone: string;
    AltPhone: string;
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
}

export type SimproAddressType = {
    Address: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
};

export type SimproCustomerType = {
    ID: number;
    CompanyName: string;
    GivenName?: string;
    FamilyName?: string;
    Phone?: string;
    Address?: SimproAddressType;
};

export type SimproTotalType = {
    ExTax: number;
    Tax: number;
    IncTax: number;
    ReverseChargeTax?: number;
    BalanceDue?: number;
    AmountApplied?: number;
};


export type SimproInvoiceType = {
    ID: number;
    Customer: SimproCustomerType;
    Status: {
        ID: number;
        Name: string;
    };
    Stage: string;
    OrderNo: string;
    Total: SimproTotalType;
    IsPaid: boolean;
    DateIssued: string;
    DatePaid: string;
    DateCreated: string;
    PaymentTerms: {
        Days: number;
        Type: string;
        DueDate: string;
    };
    LatePaymentFee?: boolean;
};


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


export type SimproCreditNoteType = {
    ID: number;
    Customer: SimproCustomerType;
    InvoiceNo: number;
    Stage: string;
    Total: SimproTotalType;
    DateIssued: string,
    InvoiceData?: SimproInvoiceType;
    Type: string;
};


export type SimproPaymentType = {
    Payment: {
        PaymentMethod: {
            ID: number;
            Name: string;
        };
        Status: string;
        DepositAccount: string;
        Date: string; 
        FinanceCharge: number;
        CheckNo: string;
        Details: string;
    };
};



export type SimproCustomerPaymentsType = {
    ID: number;
    Payment: SimproPaymentType,
    Invoices: SimproInvoicesType[]
}