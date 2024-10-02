import { CreditorsWatchContactType, CreditorsWatchInvoiceType, SimproInvoiceType } from "../types/types";
import { SimproCompanyType } from "../types/types";

type SourceType = 'Simpro' | 'RemoteFlow';

export const transformContactDataToCreditorsWatchArray = <T>(source: SourceType, customers: T[]): CreditorsWatchContactType[] => {
    return customers.map((customer) => {
        switch (source) {
            case 'Simpro':
                const simproCustomer = customer as SimproCompanyType;
                return {
                    external_id: simproCustomer.ID.toString(),
                    name: simproCustomer.CompanyName,
                    email: simproCustomer.Email,
                    status: simproCustomer.Archived ? 'deleted' : 'active',
                    registration_number: simproCustomer.EIN,
                    tax_number: '',
                    phone_number: simproCustomer.Phone,
                    mobile_number: simproCustomer.AltPhone
                };
            case 'RemoteFlow':
                // Write the code to handle as per RemoteFlowCustomerType.
                return {
                    external_id: "",
                    name: "",
                    email: "",
                    status: "",
                    registration_number: "",
                    tax_number: "",
                    phone_number: "",
                    mobile_number: ""
                };
            default:
                throw new Error(`Unknown source type: ${source}`);
        }
    });
};



export const transformInvoiceDataToCreditorsWatchArray = <T>(source: SourceType, invoices: T[]): CreditorsWatchInvoiceType[] => {
    return invoices.map(invoice => {
        switch (source) {
            case 'Simpro':
                const simproInvoice = invoice as SimproInvoiceType;
                return {
                    external_id: simproInvoice.ID.toString(),
                    external_contact_id: simproInvoice.Customer.ID.toString(),
                    status: "AUTHORISED",
                    invoice_number: simproInvoice.ID.toString(),
                    currency_code: "AUD",
                    currency_rate: "1.0",
                    amount_due: simproInvoice?.Total?.BalanceDue || 0,
                    amount_paid: simproInvoice?.Total?.AmountApplied || 0,
                    total_amount: simproInvoice?.Total?.IncTax || 0,
                    invoice_date: "ddate`",
                    due_date: simproInvoice?.PaymentTerms?.DueDate || "",
                    paid_date: simproInvoice.IsPaid ? simproInvoice.DatePaid : null,
                }
            case 'RemoteFlow':
                // Write logic as per remote flow invoice type. 
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