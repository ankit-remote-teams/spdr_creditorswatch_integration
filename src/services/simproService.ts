import { AxiosError } from "axios";
import axiosSimPRO from "../config/axiosSimProConfig";
import { SimproCompanyType } from "../types/types";

export const fetchSimproPaginatedData = async <T>(url: string, columns: string, ifModifiedSinceHeader?: string): Promise<T[]> => {
    try {
        let pageNum: number = 1;
        let allEntity: T[] = [];
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

            console.log(`Fetching page ${pageNum}...`);
            const response = await axiosSimPRO.get(url, requestOptions);

            const entity = response.data;
            if (!entity || entity.length === 0) {
                console.warn(`No entity found on page ${pageNum}`);
                break;
            }

            allEntity.push(...entity);

            totalPages = parseInt(response.headers['result-pages'], 10) || 1;
            pageNum++;
        } while (pageNum <= totalPages);

        return allEntity;

    } catch (error) {
        if (error instanceof AxiosError) {
            console.error('Error fetching paginated data:', error.response?.data || error.message);
            throw { message: 'Error from Axios request', details: error.response?.data };
        } else {
            console.error('Error fetching paginated data:', error);
            throw new Error('Failed to fetch data');
        }
    }
};
