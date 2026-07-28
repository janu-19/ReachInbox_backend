import { Router } from 'express';
import { addSender, getSenders, createSenderSchema } from '../controllers/sender.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Apply auth guard on all SMTP management routes
router.use(requireAuth);

router.post('/', validate(createSenderSchema), addSender);
router.get('/', getSenders);

export default router;
