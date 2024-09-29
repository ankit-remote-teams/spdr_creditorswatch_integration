import { CreditorsWatchContactType } from "../types/types";

type SourceType = 'Simpro' | 'RemoteFlow';

export const transformToCreditorWatchArray = (source: SourceType, users: any[]): CreditorsWatchContactType[] => {
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
