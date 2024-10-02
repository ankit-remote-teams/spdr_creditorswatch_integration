import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import syncRoutes from './routes/syncRoutes';
import mongoose from 'mongoose';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
const app = express();

const PORT: number = parseInt(process.env.PORT as string, 10) || 6001;

// For Dev
// if (process.env.NODE_ENV === 'development') {
//     const cronJobs = [
//         './cron/createUpdateContactsDataScheduler.ts',
//     ];
//     cronJobs.forEach(job => {
//         require(job);
//     });
// }

app.use('/api', syncRoutes);

app.get('/', (req: Request, res: Response) => {
    res.send('Server is running!!');
});

mongoose.connect(process.env.DB_URL as string).then(() => {
    console.log('MongoDB Connected...');
}).catch((error) => {
    console.error(error);
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
