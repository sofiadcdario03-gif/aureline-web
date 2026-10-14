import app from './index.js';

export default async function handler(req, res) {
  console.log('=== Serverless Function Start ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Has MONGO_URI:', !!process.env.MONGO_URI);
  console.log('Has JWT_SECRET:', !!process.env.JWT_SECRET);
  
  try {
    await app(req, res);
    console.log('=== Request handled successfully ===');
  } catch (error) {
    console.error('=== Serverless Function Error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        name: error.name
      });
    }
  }
}
