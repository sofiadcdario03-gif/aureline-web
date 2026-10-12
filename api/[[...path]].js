import { createExpressApp } from '@vercel/express';
import app from './index.js';

export default createExpressApp(app);
