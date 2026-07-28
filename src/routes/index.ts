import { Router } from 'express';
import authRouter from './auth.routes.js';
import senderRouter from './sender.routes.js';
import emailRouter from './email.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/senders', senderRouter);
router.use('/', emailRouter);

export default router;
