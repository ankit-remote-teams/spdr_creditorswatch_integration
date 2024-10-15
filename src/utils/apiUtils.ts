import { AxiosResponse } from 'axios'; 
import axiosCreditorsWatch from '../config/axiosCreditorsWatchConfig';

export async function creditorsWatchPostWithRetry<T>(
    url: string,
    data: T,
    retries: number = 3,
    delay: number = 1000
): Promise<AxiosResponse | undefined> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axiosCreditorsWatch.post(url, data);
            return response;
        } catch (error) {
            console.log("Error in creditors watch post: ", error)
            if (attempt < retries - 1) {
                console.warn(`Attempt ${attempt + 1} failed. Retrying...`);
                await new Promise((res) => setTimeout(res, delay));
            } else {
                console.log('Max retries reached in creditsWatch post. Failing request.');
                return undefined;
            }
        }
    }
}

export async function creditorsWatchPutWithRetry<T>(
    url: string,
    data: T,
    retries: number = 3,
    delay: number = 1000
): Promise<AxiosResponse | undefined> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axiosCreditorsWatch.put(url, data);
            return response;
        } catch (error) {
            console.log("Error in creditors watch put: ", error)
            if (attempt < retries - 1) {
                console.warn(`Attempt ${attempt + 1} failed. Retrying...`);
                await new Promise((res) => setTimeout(res, delay));
            } else {
                console.log('Max retries reached in creditsWatch put. Failing request.');
                return undefined;
            }
        }
    }
}

