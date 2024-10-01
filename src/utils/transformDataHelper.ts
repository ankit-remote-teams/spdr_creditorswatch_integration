import { CreditorsWatchContactType, CreditorsWatchInvoiceType } from "../types/types";

type SourceType = 'Simpro' | 'RemoteFlow';

export const transformContactDataToCreditorsWatchArray = (source: SourceType, users: any[]): CreditorsWatchContactType[] => {
    return users.map(user => {
        switch (source) {
            case 'Simpro':
                return {
                    external_id: user.ID.toString(),
                    name: user.CompanyName,
                    email: user.Email,
                    status: user.Archived ? 'deleted' : 'active',
                    registration_number: user.EIN,
                    tax_number: '',
                    phone_number: user.Phone,
                    mobile_number: user.AltPhone
                };
            case 'RemoteFlow':
                return {
                    external_id: user.otherID,
                    name: user.businessName,
                    email: user.contactEmail,
                    status: user.isDeleted ? 'deleted' : 'active',
                    registration_number: user.registrationID,
                    tax_number: user.taxID,
                    phone_number: user.businessPhone,
                    mobile_number: user.personalPhone
                };
            default:
                throw new Error(`Unknown source type: ${source}`);
        }
    });
};


export const transformInvoiceDataToCreditorsWatchArray = (source: SourceType, users: any[]): CreditorsWatchInvoiceType[] => {
    return users.map(user => {
        switch (source) {
            case 'Simpro':
                return {
                    external_id: "your invoice ID alpha-numeric string",
                    external_contact_id: "ABC123",
                    status: "AUTHORISED",
                    invoice_number: "INV-123456",
                    currency_code: "USD",
                    currency_rate: "1.0",
                    amount_due: 123.45,
                    amount_paid: 0,
                    total_amount: 123.45,
                    invoice_date: "ddate`",
                    due_date: "YYYY-MM-DD",
                    paid_date: null,
                }
            case 'RemoteFlow':
                return {
                    external_id: "your invoice ID alpha-numeric string",
                    external_contact_id: "ABC123",
                    status: "AUTHORISED",
                    invoice_number: "INV-123456",
                    currency_code: "USD",
                    currency_rate: "1.0",
                    amount_due: 123.45,
                    amount_paid: 0,
                    total_amount: 123.45,
                    invoice_date: "ddate`",
                    due_date: "YYYY-MM-DD",
                    paid_date: null,
                }
            default:
                throw new Error(`Unknown source type: ${source}`);
        }
    });
};


export const transformCreditNoteDataToCreditorsWatchArray = (source: SourceType, users: any[]): CreditorsWatchContactType[] => {
    return users.map(user => {
        switch (source) {
            case 'Simpro':
                return {
                    external_id: user.ID.toString(),
                    name: user.CompanyName,
                    email: user.Email,
                    status: user.Archived ? 'deleted' : 'active',
                    registration_number: user.EIN,
                    tax_number: '',
                    phone_number: user.Phone,
                    mobile_number: user.AltPhone
                };
            case 'RemoteFlow':
                return {
                    external_id: user.otherID,
                    name: user.businessName,
                    email: user.contactEmail,
                    status: user.isDeleted ? 'deleted' : 'active',
                    registration_number: user.registrationID,
                    tax_number: user.taxID,
                    phone_number: user.businessPhone,
                    mobile_number: user.personalPhone
                };
            default:
                throw new Error(`Unknown source type: ${source}`);
        }
    });
};