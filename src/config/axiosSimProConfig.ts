// /src/api/axiosSimPROConfig.ts
import axios, { AxiosInstance } from 'axios';
import rateLimit from 'axios-rate-limit';

// Create Axios instance for SimPRO API
const axiosSimPRO: AxiosInstance = rateLimit(axios.create({
    baseURL: `${process.env.SIMPRO_BASE_URL}/companies/${process.env.SIMPRO_COMPANY_ID}`,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SIMPRO_ACCESS_TOKEN}`,
    },
    timeout: 600000,
}), {
    maxRequests: 1,
    perMilliseconds: 1000
  });

// Request Interceptor
axiosSimPRO.interceptors.request.use(
    (config) => {
        console.log('Request to SimPRO:', config.url);
        return config;
    },
    (error) => {
        console.log('Request error:', error);
        return Promise.reject(error);
    }
);

// Response Interceptor
axiosSimPRO.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.log('Unauthorized, possibly invalid token.');
        }
        if (error.response?.status === 429) {
            console.log('Rate limit exceeded.');
        }
        return Promise.reject(error);
    }
);

export default axiosSimPRO;
