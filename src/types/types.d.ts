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
}

export type SimproInvoiceType = {
    ID: number;
    Customer: {
        ID: number;
        CompanyName: string;
        GivenName: string;
        FamilyName: string;
    };
    Status: {
        ID: number;
        Name: string;
    };
    Stage: string;
    OrderNo: string;
    Total: {
        ExTax: number;
        IncTax: number;
        Tax: number;
        ReverseChargeTax: number;
        AmountApplied: number;
        BalanceDue: number;
    };
    IsPaid: boolean;
    DateIssued: string;
    DatePaid: string;
    DateCreated: string;
    DateModified: string;
    PaymentTerms: {
        Days: number;
        Type: string;
        DueDate: string;
    };
    Period: {
        StartDate: string;
        EndDate: string;
    };
};
