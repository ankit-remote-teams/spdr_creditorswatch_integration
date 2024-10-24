import { Request, Response, NextFunction } from 'express';

const apiKey = process.env.AUTH_API_KEY || "";
const VALID_API_KEYS: string[] = [apiKey];

// Middleware function to authenticate API key
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
        res.status(401).json({ error: 'API key is missing' });
        return;
    }

    if (!VALID_API_KEYS.includes(apiKey)) {
        res.status(403).json({ error: 'Invalid API key' });
        return;
    }

    next();
};
