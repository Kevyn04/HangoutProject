# The Hangout

A social location app built with React Native (Expo) + Spring Boot + MySQL.

## Setup

### Backend
1. Create a MySQL database named `hangout_db`
2. Copy the config template:
   ```
   cp HangoutBack/hangout-backend/src/main/resources/application.properties.example \
      HangoutBack/hangout-backend/src/main/resources/application.properties
   ```
3. Fill in your database username and password in `application.properties`
4. Run the Spring Boot app (port 8080)

### Frontend
1. Install dependencies:
   ```
   cd HangoutFront
   npm install
   ```
2. Update `constants.ts` with your PC's local IP address
3. Start Expo:
   ```
   npx expo start
   ```
4. Scan the QR code with Expo Go on your phone
