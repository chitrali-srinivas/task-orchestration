# Mati Carbon Authentication Demo

A minimal Next.js application demonstrating an SSO-like authentication flow with Google Sign-In and a static OTP verification layer. Built with Shadcn/ui and Tailwind CSS, themed for Mati Carbon.

## Features

- **Google Sign-In**: Integrated via Firebase Authentication.
- **OTP Verification**: A static OTP layer (`123456`) with attempt tracking and lockout logic.
- **Dashboard**: A mock portal selection screen.
- **Responsive Design**: Mobile-friendly layout suitable for PWA usage.
- **Theming**: Custom Zinc theme with Mati Carbon's Gold and Green accents.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Components**: Shadcn/ui
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Icons**: Lucide React

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Firebase**:
   - Create a project in the [Firebase Console](https://console.firebase.google.com/).
   - Enable **Google Sign-In** in the Authentication section.
   - Create a web app in Firebase and copy the configuration.
   - Create a `.env.local` file in the root directory and add your Firebase config keys:
     ```env
     NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
     ```
   - *Note: For this demo, you can also directly edit `src/lib/firebase.ts` if you prefer not to use env vars.*

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.

## Testing Guide

### 1. Google Sign-In
- Click "Proceed" on the Welcome Screen.
- Click "Continue with Google".
- **Test**: Sign in with different Google accounts.
- **Verify**: Check the browser console for `Logged in with email: [email]`.

### 2. OTP Verification
- After signing in, you will be redirected to the OTP screen.
- **Correct OTP**: Enter `123456` to proceed to the Dashboard.
- **Incorrect OTP**: Enter any other 6-digit code.
  - **Verify**: Alert shows "Incorrect OTP".
  - **Verify**: Console logs `OTP attempt failed`.
- **Lockout**: Enter an incorrect OTP 3 times.
  - **Verify**: Input and button are disabled.
  - **Verify**: Alert shows "Maximum tries reached" with a 60-second countdown.

### 3. Dashboard & Logout
- Click on any portal card to see the console log `Navigating to [Portal Name]`.
- Click "Sign Out" to return to the Welcome Screen.

## Cross-Platform / Mobile
- This web app is PWA-ready. You can add it to your mobile home screen for a native-like experience.
- **Native Port**: For a full native mobile app, this logic can be ported to React Native using **Tamagui** or **NativeWind** to replicate the Shadcn Zinc theme, and **Expo Google Auth** for native sign-in.
