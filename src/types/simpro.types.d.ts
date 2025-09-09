import { InvoiceItemPaymentsType } from "./creditorswatch.types";

type CustomFieldValue = string | number | null;

export type SimproStaffType = {
    ID: number;
    Name: string;
    Type: string;
    TypeId: number;
}

export type SimproAccountType = {
    ID: number;
    Name: string;
    Number: number;
    Type?: string;
    Archived?: boolean;
}

export type SimproManagerType = SimproStaffType;

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
    Claimed?: {
        ToDate?: {
            Percent?: number;
            Amount?: SimproTotalType;
        },
        Remaining?: {
            Percent?: number;
            Amount?: SimproTotalType;
        }
    };
    Total?: SimproTotalType;
    Totals?: SimproTotalsType;
    Site?: SimproSiteType;
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
    CostCenter?: SimproCostCenterType;
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
    Tax?: number;
    IncTax: number;
    ReverseChargeTax?: number;
    BalanceDue?: number;
    AmountApplied?: number;
};

export type SimproTotalsType = {
    InvoicedValue: number;
    InvoicePercentage?: number;
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
    Address?: SimproAddressType;
}

export type SimproTagsType = {
    ID: number;
    Name: string;
}


export type SimproJobStatusType = {
    ID: number;
    Name: string;
    Color: string;
}



export type SimproCustomField = {
    ID: number;
    Name: string;
    Type: string;
    IsMandatory?: boolean;
    ListItems?: string[];
    Value?: CustomFieldValue
}

export type SimproCustomFieldWithValue = {
    CustomField: SimproCustomField,
    Value: string | number | null;
}


export type SimproJobType = {
    ID: number;
    Type: string;
    Customer?: SimproCustomerType;
    Site?: SimproSiteType;
    SiteContact?: SimproCustomerType | null;
    DateIssued?: string;
    Status?: SimproStatusType;
    Total?: SimproTotalType;
    Name?: string;
    ProjectManager?: SimproManagerType | null;
    CustomFields?: SimproCustomFieldWithValue[];
    Totals?: SimproTotalsType;
    Stage?: string;
}

export type SimproConvertedFromLeadType = {
    ID: number;
    LeadName: string;
    DateCreated: string;
}

export type SimproQuotationStatusType = {
    ID: number;
    Name: string;
    Color: string;
}

export type SimproCostType = {
    Estimate: number;
    Revised: number;
    Revized: number;
}

export type SimproQuotationTotalsType = {
    MaterialsCost: Cost;
    ResourcesCost: {
        Total: Cost;
        Labor: Cost;
        LaborHours: Cost;
        PlantAndEquipment: Cost;
        PlantAndEquipmentHours: Cost;
        Commission: Cost;
        Overhead: Cost;
    };
    MaterialsMarkup: Cost;
    ResourcesMarkup: {
        Total: Cost;
        Labor: Cost;
        PlantAndEquipment: Cost;
    };
    Adjusted: Cost;
    MembershipDiscount: number;
    Discount: number;
    STCs: number;
    VEECs: number;
    GrossProfitLoss: Cost;
    GrossMargin: Cost;
    NettProfitLoss: Cost;
    NettMargin: Cost;

}

export type SimproQuotationType = {
    ID: number;
    Name: string;
    ConvertedFromLead: SimproConvertedFromLeadType;
    Status: SimproQuotationStatusType;
    DateIssued: string;
    Salesperson: SimproStaffType;
    Customer: SimproCustomerType;
    Site: SimproSiteType;
    Tags: SimproTagsType[];
    DueDate: string | null;
    Total: SimproTotalType;
    Stage?: string;
    CustomFields?: SimproCustomFieldWithValue[];
}


type SimproLeadType = {
    ID: number;
    LeadName: string;
    Stage: string;
    Status: SimproJobStatusType;
    ProjectManager: SimproStaffType;
    Salesperson: SimproStaffType;
    Customer: SimproCustomerType;
    FollowUpDate: string;
    DateCreated: string;
    Site: SimproSiteType;
    Tags: SimproTagsType[];
    CustomFields?: SimproCustomFieldWithValue[];
};

type SimproWebhookReference = {
    companyID: number;
    scheduleID: number;
    jobID: number;
    sectionID: number;
    costCenterID: number;
    invoiceID?: number;
    contractorJobID?: number;
};

type SimproWebhookType = {
    ID: string;
    build: string;
    description: string;
    name: string;
    action: 'created' | 'updated' | 'deleted';
    reference: SimproWebhookReference;
    date_triggered: string; // ISO 8601 date string
};

type SimproJobCostCenterType = {
    ID: number;
    ccRecordId: number;
    CostCenter: SimproCostCenterType;
    Name: string;
    Job: SimproJobType;
    Section: {
        ID: number;
        Name: string;
    };
    DateModified: string; // ISO 8601 date string 
    _href: string;
};

export type SimproLineItemAmountType = {
    ExTax: number;
    IncTax: number;
    ReverseChargeTax?: number;
}

export type SimproClaimedType = {
    ToDate: {
        Qty: number;
        Amount: SimproLineItemAmountType;
    };
    Remaining: {
        Qty: number;
        Amount: SimproLineItemAmountType;
    };
}

export type SimproItemClassType = {
    ID: number;
    PartNo?: string;
    Name?: string;
}

export type SimproLineItemType = {
    ID: number;
    Total: SimproLineItemAmountType;
    Claimed: SimproClaimedType;
    Prebuild?: SimproItemClassType;
    Catalog?: SimproItemClassType;
    Qty: { Assigned: number; Remaining: number; };
    Price: { Labor: number; Material: number; };
};

export type SimproItemType = {
    Prebuilds?: SimproLineItemType[];
    Catalogs?: SimproLineItemType[];
}

export type SimproContractorJobType = {
    ID: number;
    Status: string;
    DateIssued: string;
    Items: SimproItemType;
    Total: SimproLineItemAmountType;
    _href?: string;
}


export type SimproCostCenter= {
  ID: number;
}
