# Deployment Guide for GitHub Pages

## Quick Deploy

To deploy The Order to GitHub Pages, run:

```bash
npm run deploy
```

This will:
1. Build the production bundle (`npm run build`)
2. Deploy the `dist` folder to the `gh-pages` branch
3. Make your app available at `https://[username].github.io/The-Order/`

## First-Time Setup

Before deploying, ensure your GitHub repository is set up:

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for GitHub Pages deployment"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under "Source", select the `gh-pages` branch
   - Click **Save**

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Wait a few minutes** for GitHub to build and deploy your site

5. **Visit your app** at: `https://[your-username].github.io/The-Order/`

## Configuration Details

The following changes were made to enable GitHub Pages deployment:

- **`vite.config.ts`**: Added `base: '/The-Order/'` to ensure assets load correctly from the subdirectory
- **`package.json`**: Added `deploy` and `predeploy` scripts
- **Dependencies**: Added `gh-pages` package for automated deployment

## Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `public` folder with your domain name
2. Configure DNS settings with your domain provider
3. Update the `base` path in `vite.config.ts` to `'/'`

## Troubleshooting

- **404 errors**: Make sure the `base` path in `vite.config.ts` matches your repository name
- **Assets not loading**: Clear your browser cache and hard refresh (Cmd+Shift+R)
- **Changes not appearing**: GitHub Pages can take 1-5 minutes to update after deployment
