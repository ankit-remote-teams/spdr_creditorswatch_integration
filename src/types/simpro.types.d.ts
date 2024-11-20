import { InvoiceItemPaymentsType } from "./creditorswatch.types";

export type SimproStaffType = {
    ID: number;
    Name: string;
    Type: string;
    TypeId: number;
}

export type SimproScheduleBlockType = {
    Hrs: number;
    StartTime: string;
    ISO8601StartTime: string;
    EndTime: string;
    ISO8601EndTime: string;
    ScheduleRate: SimproScheduleRateType;
}

export type SimproScheduleRateType = {
    ID: number;
    Name: string;
}

export type SimproCostCenterType = {
    Name: string;
    ID: number;
}

export type SimproScheduleType = {
    ID: number;
    Type: string;
    Reference: string;
    TotalHours?: number;
    Staff: SimproStaffType;
    Date: string;
    Blocks: SimproScheduleBlockType[];
    Job?: SimproJobType;
    CostCenter?: SimproCostCenterType[];
    Notes?: string;
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
    CompanyName?: string;
    GivenName?: string;
    FamilyName?: string;
    Phone?: string;
    Address?: SimproAddressType;
    _href?: string;
    Type?: string;
    Phone?: string;
    Email?: string;
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
    Type: string;
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
    InvoicePaymentInfo?: InvoiceItemPaymentsType[] | null;
};

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

export type SimproCustomerPaymentsType = {
    ID: number;
    Payment: SimproPaymentType,
    Invoices: SimproInvoicesType[]
}


export type SimproCompanyType = {
    ID: number;
    CompanyName: string;
    Email: string;
    Archived: boolean;
    EIN: string;
    Phone: string;
    AltPhone: string;
};


export type SimproSiteType = {
    ID: number;
    Name: string;
}


export type SimproJobStatusType = {
    ID: number;
    Name: string;
    Color: string;
}

export type SimproManagerType = {
    ID: number;
    Name: string;
    Type: string;
    TypeId: number;
}

export type SimproCustomField = {
    ID: number;
    Name: string;
    Type: string;
    IsMandatory?: boolean;
    ListItems?: string[];
}

export type SimproCustomFieldWithValue = {
    CustomField: SimproCustomField,
    Value: string | number | null;
}


export type SimproJobType = {
    ID: number;
    Type: string;
    Customer: SimproCustomerType;
    Site: SimproSiteType;
    SiteContact: SimproCustomerType | null;
    DateIssued: string;
    Status: SimproStatusType;
    Total: SimproTotalType;
    Name?: string;
    ProjectManager?: SimproManagerType | null;
    CustomFields?: SimproCustomFieldWithValue[];
}