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
