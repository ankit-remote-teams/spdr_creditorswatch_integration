import { Request, Response, NextFunction } from 'express';



// Middleware function to authenticate API key
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string;
    const apiKeyFromEnv = process.env.AUTH_API_KEY || "";
    const VALID_API_KEYS: string[] = [apiKeyFromEnv];
    
    console.log('apiKey', apiKey);
    console.log('proveces auth pai ', process.env.AUTH_API_KEY)
    console.log('VALID_API_KEYS', VALID_API_KEYS)
    console.log(VALID_API_KEYS[0] === apiKey)
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
