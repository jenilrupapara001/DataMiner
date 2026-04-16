import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'rsuite/dist/rsuite-no-reset.min.css';
import './styles/rsuite-overrides.css';
import './index.css'
import App from './App.jsx'
import "@cometchat/chat-uikit-react/css-variables.css";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { setupLocalization } from "./CometChat/utils/utils";
import { CometChatProvider } from "./CometChat/context/CometChatContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes cache as per requirement
    },
  },
});

export const COMETCHAT_CONSTANTS = {
  APP_ID: "1675623ba4da04e9e",
  REGION: "in",
  AUTH_KEY: "6a2c1e0c3a6a367dc9ed2056631ad2523ba69622",
};

const uiKitSettings = new UIKitSettingsBuilder()
  .setAppId(COMETCHAT_CONSTANTS.APP_ID)
  .setRegion(COMETCHAT_CONSTANTS.REGION)
  .setAuthKey(COMETCHAT_CONSTANTS.AUTH_KEY)
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(uiKitSettings)?.then(() => {
  setupLocalization();
  createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <CometChatProvider>
          <App />
        </CometChatProvider>
      </QueryClientProvider>
    </BrowserRouter>,
  )
}).catch(err => {
  console.error("CometChat initialization failed:", err);
  // Fallback to normal render if initialization fails
  createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>,
  )
});
