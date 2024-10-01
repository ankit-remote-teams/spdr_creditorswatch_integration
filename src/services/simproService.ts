import axiosSimPRO from "../config/axiosSimProConfig";
import { SimproCompanyType } from "../types/types";

export const fetchSimproPaginatedData = async (url: string, columns: string, ifModifiedSinceHeader: string): Promise<SimproCompanyType[]> => {
    try {
        let pageNum: number = 1;
        let allCustomers: SimproCompanyType[] = [];
        let totalPages: number = 1;

        do {
            const requestOptions: any = {
                params: {
                    page: pageNum,
                    search: 'any',
                    columns: columns,
                }
            };

            if (ifModifiedSinceHeader) {
                requestOptions.headers = {
                    'If-Modified-Since': ifModifiedSinceHeader
                };
            }

            const response = await axiosSimPRO.get(url, requestOptions);

            const customers = response.data;
            if (!customers || customers.length === 0) {
                console.warn(`No customers found on page ${pageNum}`);
                break;
            }

            allCustomers.push(...customers);

            totalPages = parseInt(response.headers['result-pages'], 10) || 1;
            pageNum++;
        } while (pageNum <= totalPages);

        return allCustomers;

    } catch (error) {
        console.error('Error fetching paginated data:', error);
        throw new Error('Failed to fetch customer data');
    }
};
