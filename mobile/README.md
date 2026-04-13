# Mobile App Scaffold

Expo React Native scaffold for the Phase 4 mobile product.

## Supported flows

- Compare two vehicle videos with `/compare`
- Analyze damage from photo or video with `/analyze`
- Estimate value from photo or video with `/valuation`
- Store local result history with AsyncStorage
- Show an account/auth placeholder until backend auth exists

## Run

```bash
cd mobile
npm install
npm start
```

Set backend URL with:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

Use your machine LAN IP when testing on a physical phone.
