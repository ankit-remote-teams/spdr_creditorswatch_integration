import axios, {
  AxiosInstance,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig
} from 'axios';
import rateLimit from 'axios-rate-limit';
import axiosRetry, { isNetworkOrIdempotentRequestError } from 'axios-retry';

// Create base Axios instance
const baseAxios: AxiosInstance = axios.create({
  baseURL: `${process.env.SIMPRO_BASE_URL}/companies/${process.env.SIMPRO_COMPANY_ID}`,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.SIMPRO_ACCESS_TOKEN}`,
  },
  timeout: 600000, // 10 minutes
});

// Apply rate limiting: max 5 requests per 1000ms
const axiosSimPRO: AxiosInstance = rateLimit(baseAxios, {
  maxRequests: 5,
  perMilliseconds: 1000,
});

// Apply retry logic
axiosRetry(axiosSimPRO, {
  retries: 3,
  retryCondition: (error: AxiosError): boolean => {
    const status = error.response?.status;
    return (
      status === 429 || // Rate limit exceeded
      (status !== undefined && status >= 500 && status < 600) || // Server errors
      isNetworkOrIdempotentRequestError(error) // Network issues
    );
  },
  retryDelay: (retryCount: number): number => {
    const delay = retryCount * 1000; // Exponential backoff
    console.log(`🔁 Retrying request... attempt #${retryCount}, waiting ${delay}ms`);
    return delay;
  },
});

// Request Interceptor
axiosSimPRO.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // console.log(`➡️ [${config.method?.toUpperCase()}] Request to SimPRO: ${config.url}`);
    return config;
  },
  (error: AxiosError): Promise<never> => {
    console.error('❌ Request error:', error.message);
    return Promise.reject(error);
  }
);

// Response Interceptor
axiosSimPRO.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  (error: AxiosError): Promise<never> => {
    const status = error.response?.status;

    if (status === 401) {
      console.warn('🔒 Unauthorized: Invalid or expired token.');
    } else if (status === 429) {
      console.warn('🚦 Rate limit exceeded (429).');
    } else if (status) {
      console.error(`⚠️ Error from SimPRO (HTTP ${status}):`, error.message);
    } else {
      console.error('🚫 Unknown response error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default axiosSimPRO;
