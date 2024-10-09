import { CreditorsWatchContactType, CreditorsWatchCreditNoteType, CreditorsWatchInvoiceType, SimproCreditNoteType, SimproInvoiceType } from "../types/types";
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
                    external_id: simproInvoice?.ID?.toString(),
                    external_contact_id: simproInvoice?.Customer?.ID?.toString(),
                    status: simproInvoice?.IsPaid ? "paid" : simproInvoice?.Stage == "Pending" ? "draft" : "authorised",
                    invoice_number: simproInvoice?.ID?.toString(),
                    currency_code: "AUD",
                    currency_rate: "1.0",
                    amount_due: simproInvoice?.Total?.BalanceDue || 0,
                    amount_paid: simproInvoice?.Total?.AmountApplied || 0,
                    total_amount: simproInvoice?.Total?.IncTax || 0,
                    invoice_date: simproInvoice?.DateIssued,
                    due_date: simproInvoice?.PaymentTerms?.DueDate || "",
                    paid_date: simproInvoice.IsPaid ? simproInvoice.DatePaid : null,
                    LatePaymentFee: simproInvoice?.LatePaymentFee?.toString() == "true" ? true : false,
                    payments: simproInvoice?.InvoicePaymentInfo?.map(item => ({
                        paymentDate: item.paymentDate,
                        paymentInvoiceAmount: item.paymentInvoiceAmount
                    })),
                };
            case 'RemoteFlow':
                // Write logic as per remote flow invoice type. 
                return {
                    external_id: "your invoice ID alpha-numeric string",
                    external_contact_id: "ABC123",
                    status: "authorised",
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


export const transformCreditNoteDataToCreditorsWatchArray = <T>(source: SourceType, creditNotes: T[]): CreditorsWatchCreditNoteType[] => {
    return creditNotes.map(creditNote => {
        switch (source) {
            case 'Simpro':
                const simproCreditNotes = creditNote as SimproCreditNoteType;
                return {
                    amount_remaining: (simproCreditNotes.InvoiceData?.Total?.IncTax || 0) - (simproCreditNotes?.Total?.IncTax || 0),
                    credit_note_number: simproCreditNotes?.ID?.toString(),
                    currency_code: "AUD",
                    currency_rate: "1.0",
                    date: simproCreditNotes?.DateIssued,
                    external_contact_id: simproCreditNotes?.Customer?.ID?.toString(),
                    external_id: simproCreditNotes?.ID?.toString(),
                    status: simproCreditNotes?.Type == "Void" ? "voided" : "authorised",
                    total_amount: simproCreditNotes?.Total?.IncTax,
                };
            case 'RemoteFlow':
                return {
                    amount_remaining: 0,
                    credit_note_number: "",
                    currency_code: "",
                    currency_rate: "",
                    date: "",
                    external_contact_id: "",
                    external_id: "",
                    status: "",
                    total_amount: 0
                };
            default:
                throw new Error(`Unknown source type: ${source}`);
        }
    });
};