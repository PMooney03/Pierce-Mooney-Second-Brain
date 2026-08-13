# Railway Deployment Guide

This guide will help you deploy your World Mapping application to Railway.

## Prerequisites

1. **GitHub Account** - Your code needs to be on GitHub
2. **Railway Account** - Sign up at [railway.app](https://railway.app) (free tier available)

## Step-by-Step Deployment

### Step 1: Push Code to GitHub

1. Initialize git (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create a repository on GitHub and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Railway

1. **Sign up/Login to Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub (easiest way)

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will detect the Dockerfile and start building

3. **Add PostgreSQL Database**
   - In your Railway project, click "+ New"
   - Select "Database" → "Add PostgreSQL"
   - Railway will automatically create a PostgreSQL database with PostGIS
   - The `DATABASE_URL` environment variable will be automatically set

4. **Configure Environment Variables**
   - Go to your service → "Variables" tab
   - Add these if needed:
     - `SECRET_KEY` - Generate a new one: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
     - `DEBUG` - Set to `False` for production
     - Railway automatically provides:
       - `DATABASE_URL` (from PostgreSQL service)
       - `PORT` (for the app to listen on)
       - `RAILWAY_PUBLIC_DOMAIN` (your app URL)

5. **Deploy**
   - Railway will automatically deploy when you push to GitHub
   - Or click "Deploy" in the Railway dashboard
   - Wait for the build to complete

### Step 3: Run Migrations

1. In Railway dashboard, go to your service
2. Click "Deployments" → Select your latest deployment
3. Click "View Logs" or use the "Shell" tab
4. Run migrations:
   ```bash
   python manage.py migrate
   ```

### Step 4: Get Your Public URL

1. In Railway dashboard, go to your service
2. Click "Settings" → "Networking"
3. Generate a public domain (or use the provided one)
4. Your app will be available at: `https://your-app.railway.app`

### Step 5: Access from iPhone

1. Open Safari on your iPhone
2. Go to: `https://your-app.railway.app`
3. Add to Home Screen (Share → Add to Home Screen)
4. Done! Your app is now accessible from anywhere

## Environment Variables Reference

Railway automatically provides:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Port to bind the app to
- `RAILWAY_PUBLIC_DOMAIN` - Your public domain
- `RAILWAY_ENVIRONMENT` - Environment name

You should set:
- `SECRET_KEY` - Django secret key (generate a new one)
- `DEBUG` - Set to `False` for production

## Troubleshooting

### Build Fails
- Check Railway logs for errors
- Ensure Dockerfile is correct
- Verify all dependencies in requirements.txt

### Database Connection Issues
- Make sure PostgreSQL service is added
- Check that `DATABASE_URL` is set automatically
- Verify migrations have run

### Static Files Not Loading
- Static files are collected during build
- Check that `STATIC_ROOT` is set correctly
- Verify `collectstatic` runs in Dockerfile

### App Not Accessible
- Check that public domain is generated
- Verify `ALLOWED_HOSTS` includes your domain
- Check Railway service logs

## Updating Your App

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
3. Railway will automatically redeploy

## Cost

Railway offers:
- **Free Tier**: $5 credit per month
- **Hobby Plan**: $5/month for more resources
- Perfect for development and demos!

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

