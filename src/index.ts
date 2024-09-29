import express from 'express';
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import syncRoutes from './routes/syncRoutes';

const app = express();

const PORT = process.env.PORT || 6001;

app.use('/api', syncRoutes)

app.get('/', (req, res) => {
    res.send('Server is running!!')
})




app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})