# tmdb-cloudrun-express

Minimal Node/Express proxy for TMDb with optional Redis caching. Ready to deploy to Google Cloud Run.

## Local test
```bash
TMDB_KEY=your_tmdb_key npm start
```

Visit: http://localhost:8080/api/search?q=inception

## Deploy to Cloud Run
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/tmdb-proxy
gcloud run deploy tmdb-proxy \
  --image gcr.io/PROJECT_ID/tmdb-proxy \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars TMDB_KEY=YOUR_KEY
```
