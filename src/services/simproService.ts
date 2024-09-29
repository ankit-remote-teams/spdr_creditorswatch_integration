import axiosSimPRO from "../config/axiosSimProConfig";
import { SimproCompanyType } from "../types/types";

export const fetchSimproPaginatedData = async (url: string, columns: string): Promise<SimproCompanyType[]> => {
    try {
        let pageNum: number = 1;
        let allCustomers: SimproCompanyType[] = [];
        let totalPages: number = 1;

        do {
            const response = await axiosSimPRO.get(url, {
                params: {
                    page: pageNum,
                    search: 'any',
                    columns: columns,
                }
            });

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
