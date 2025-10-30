import express from 'express';
const router = express.Router();
import { apiKeyAuth } from '../middlewares/apiAuth';
import { rerunFailedRedisJobs } from '../controllers/redisController';

router.get('/check-middleware', apiKeyAuth, async (req, res) => {
    res.status(200).json({ message: 'Middleware check passed' })
})

router.get('/rerun-failed-redis-jobs/:hours',apiKeyAuth, rerunFailedRedisJobs);

export default router;
