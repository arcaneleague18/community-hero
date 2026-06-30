# Community Hero

Community Hero is a hyperlocal problem solver and civic issue reporting platform. It empowers citizens to report community issues, verifies their legitimacy with AI, and rewards community engagement.

**Live at**: https://community-hero-636434036514.us-west1.run.app

**Note:** This project is designed as a mobile-first web application, with future plans to be ported into a native Android app.

## Citizen Dashboard


https://github.com/user-attachments/assets/4cbc76bf-c8f0-4cb8-9aa5-a5545962d9b5

## Features

### 📸 Civic Issue Reporting
- **Capture & Upload**: Users can capture photos of issues (potholes, garbage, broken infrastructure) directly through the app's camera interface or upload them.
- **Geolocation**: Automatically captures or allows manual input of coordinates to accurately pinpoint the issue location.

## Reporting
- **Failed Report** : Due to invalid image

https://github.com/user-attachments/assets/e5877dfb-ab9f-4b61-bc7e-7c5f5bc23814

- **Successful report**

https://github.com/user-attachments/assets/ba3fe446-46e1-4257-b1ea-41b92d4bdd2a

### 🤖 AI-Powered Verification
- **Spam Prevention**: Uses the Gemini 2.5 Flash API to automatically verify if the provided description matches the uploaded image before submission.
- **Intelligent Feedback**: Filters out invalid reports and provides specific reasons for rejection to maintain high data quality.

### 👥 Role-Based Access & Workflows
- **Citizen**: Reports issues, tracks personal impact, upvotes community issues, and earns points.
- **Verifier**: Reviews pending reports, and validates or rejects them (rejecting deducts points from the reporter to discourage spam).
- **Admin**: Oversees all reports via a comprehensive dashboard, views regional trends, and manages the platform.

## Verifier Dashboard



https://github.com/user-attachments/assets/e4bf77de-cc26-4519-bcd9-1aa22f4f42c8



## Admin Dashboard


https://github.com/user-attachments/assets/2939b83e-8e02-4a92-bdd8-cec64de7c0b0


### 🗺️ Interactive Maps
- **Geospatial Visualization**: Integrates Google Maps Platform to visualize reported issues across different regions.
- **Location Focus**: Users and admins can explore issues on an interactive map, seeing clusters of problems geographically.
<img width="425" height="623" alt="image" src="https://github.com/user-attachments/assets/6f739707-98b2-402b-9b86-0dc17887d58e" />

### 🏆 Gamification & Leaderboard
- **Points System (PTS)**: Users earn points for reporting valid civic issues, promoting active participation in community upkeep.
- **Leaderboards**: Highlights top contributors in the community.
- **Points History**: Users can view a detailed log of their contributions and impact over time.

## Leaderboard
<img width="472" height="689" alt="Screenshot 2026-06-30 224904" src="https://github.com/user-attachments/assets/f5e53f43-ef6e-49b3-8523-b8b1dd13c631" />


### 📈 Predictive Analysis & Regional Trends
- **Trend Spotting**: Highlights areas (zones) with a high frequency of specific issues (e.g., Water Supply, Infrastructure).
- **AI Insights**: Generates predictive analysis on underlying infrastructural stress based on reporting frequency, allowing city planners to be proactive.

### 💬 AI Assistant Chatbot
- **Interactive Helper**: An integrated chatbot that assists users with app navigation, reporting guidelines, and general community queries. Integrated agentic system that can access user's screen whenever it needs to.
<img width="460" height="798" alt="image" src="https://github.com/user-attachments/assets/af0775e2-0ba8-4932-853a-a263c050f3ea" />

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Motion (animations)
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore (for storing users, complaints, and points history)
- **AI / Machine Learning**: Google GenAI SDK (Gemini 2.5 Flash)
- **Maps**: Google Maps API (`@vis.gl/react-google-maps`)

## Prerequisites

To run this project locally, you need the following environment variables defined in a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_PLATFORM_KEY=your_google_maps_platform_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

You also need to have Firebase configured properly for database interactions.

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Start the production server:**
   ```bash
   npm start
   ```

## Architecture

This is a full-stack application:
- The frontend is built as a Single Page Application (SPA) using React.
- The backend uses Express to proxy API requests (e.g., verifying issues, chatbot) and securely use the Gemini API key without exposing it to the client.
- The server is configured to run and handle both API routes and static file serving for production.
