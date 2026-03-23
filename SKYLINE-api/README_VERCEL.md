# Deploy SKYLINE-api to Vercel

## Required environment variables

Set these in Vercel Project Settings -> Environment Variables:

- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret used by auth
- `EMAIL_USER`: SMTP user (if email features are used)
- `EMAIL_PASS`: SMTP password or app password (if email features are used)
- `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name (if upload is used)
- `CLOUDINARY_API_KEY`: Cloudinary API key (if upload is used)
- `CLOUDINARY_API_SECRET`: Cloudinary API secret (if upload is used)

Optional:

- `SKIP_DB_ON_START=true` for modes that do not require MongoDB
- `AI_CHAT_DATA_SOURCE=file` to use local AI data source mode

## Notes

- Vercel deploy runs through `api/index.js`, which now loads the same Express routes used in local development.
- Socket.IO real-time channel is available in local server mode; Vercel Serverless Functions do not provide long-lived Socket.IO servers.
