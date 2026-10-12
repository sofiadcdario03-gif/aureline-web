# Vercel Deployment Instructions

## Overview
This project has been converted to use Vercel serverless functions. The backend API now runs as serverless functions alongside the frontend, eliminating the need for a separate backend deployment.

## Changes Made

### 1. Serverless API Structure
- Created `api/` directory with serverless functions
- `api/index.js` - Contains the full Express application adapted for serverless
- `api/[[...path]].js` - Catch-all route handler for API requests
- `api/db.js` - MongoDB connection pooling for serverless environment
- `api/utils.js` - Shared utilities
- `api/security.js` - Security functions (copied from server/security.js)

### 2. Frontend Configuration
- Updated `src/services/api.js` to use relative path `/api` instead of absolute URL
- This allows the frontend to call API functions on the same domain

### 3. Vercel Configuration
- `vercel.json` - Simple rewrite rule to route `/api/*` requests to serverless functions

## Environment Variables Required

Add these environment variables in your Vercel project settings:

1. **MONGO_URI** - Your MongoDB connection string
   ```
   mongodb://sofiadcdario03_db_user:jpkc1XkxW1K4rQY7@ac-ctok1cy-shard-00-00.0bs0u24.mongodb.net:27017,ac-ctok1cy-shard-00-01.0bs0u24.mongodb.net:27017,ac-ctok1cy-shard-00-02.0bs0u24.mongodb.net:27017/?ssl=true&replicaSet=atlas-5nhcns-shard-0&authSource=admin&appName=Cluster0
   ```

2. **MONGODB_DB_NAME** - Database name (default: hotel-management)

3. **JWT_SECRET** - A random secret string of at least 32 characters
   - Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

4. **EMAIL_HOST** - SMTP host (default: smtp.gmail.com)

5. **EMAIL_PORT** - SMTP port (default: 587)

6. **EMAIL_USER** - Your email address for sending notifications

7. **EMAIL_PASS** - Your email password or app-specific password

8. **FRONTEND_URL** - Your Vercel deployment URL (for password reset links)
   - Example: `https://your-app.vercel.app`

## Deployment Steps

### 1. Push to GitHub
Make sure all changes are committed and pushed to your GitHub repository.

### 2. Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel
```

**Option B: Using Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the Vite project
5. Configure environment variables in the project settings
6. Click "Deploy"

### 3. Configure Environment Variables

In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add all the variables listed above
3. Make sure to select all environments (Production, Preview, Development)
4. Redeploy after adding variables

### 4. Update FRONTEND_URL

After deployment:
1. Copy your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
2. Update the `FRONTEND_URL` environment variable with this URL
3. Redeploy

## Local Development

### Option 1: Traditional (still works)
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run dev
```

### Option 2: Using Vercel CLI locally
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Run locally
vercel dev
```

This will run both frontend and serverless functions locally.

## Important Notes

### MongoDB Connection Pooling
The serverless implementation uses connection pooling to handle multiple concurrent requests efficiently. The connection is reused across function invocations in the same environment.

### In-Memory Storage Limitations
- OTP storage, login challenges, and reset tokens are stored in memory
- In serverless, this means they may not persist across different function instances
- For production, consider using Redis or another external storage for these

### Email Links
Password reset and email links now use the `FRONTEND_URL` environment variable instead of hardcoded `localhost:5173`.

### Removed Files
The original `server.js` is still present for local development but is not used in the Vercel deployment.

## Troubleshooting

### API Calls Failing
- Check that all environment variables are set in Vercel
- Verify `MONGO_URI` is correct
- Check Vercel function logs for errors

### CORS Issues
- The serverless functions have CORS enabled for all origins
- If you need to restrict this, update the CORS configuration in `api/index.js`

### Database Connection Issues
- Ensure your MongoDB Atlas allows access from Vercel's IP ranges
- Check that `MONGO_URI` includes the correct authentication details

## Testing After Deployment

1. Test the health endpoint: `https://your-app.vercel.app/api/health`
2. Test room search: `https://your-app.vercel.app/api/rooms`
3. Test authentication by attempting to log in
4. Test password reset flow

## Rollback

If you need to rollback to the traditional deployment:
1. Revert the changes to `src/services/api.js` (use absolute URL)
2. Deploy backend separately (Render, Railway, etc.)
3. Set `VITE_API_URL` to your backend URL
4. Remove the `api/` directory and `vercel.json`
