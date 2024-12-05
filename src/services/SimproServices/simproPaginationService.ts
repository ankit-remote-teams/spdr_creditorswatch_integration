import { AxiosError } from "axios";
import axiosSimPRO from "../../config/axiosSimProConfig";


export const fetchSimproPaginatedData = async <T>(url: string, columns: string, ifModifiedSinceHeader?: string): Promise<T[]> => {
    try {

        console.log('columns', columns)
        let pageNum: number = 1;
        let allEntity: T[] = [];
        let totalPages: number = 1;

        do {
            const requestOptions: any = {
                params: {
                    page: pageNum,
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

            allEntity = allEntity.concat(entity);

            totalPages = parseInt(response.headers['result-pages'], 10) || 1;
            pageNum++;
        } while (pageNum <= totalPages);

        return allEntity;

    } catch (error) {
        if (error instanceof AxiosError) {
            console.log('Error fetching paginated data:', error.response?.data || error.message);
            throw { message: 'Error from Axios request', details: error.response?.data };
        } else {
            console.log('Error fetching paginated data:', error);
            throw error;
        }
    }
};
