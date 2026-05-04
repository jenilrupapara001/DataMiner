import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { PageTitleProvider } from './contexts/PageTitleContext';
import { DateRangeProvider } from './contexts/DateRangeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Sidebar from './components/common/Sidebar';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './contexts/ToastContext';
import { OnboardingProvider, useOnboarding } from './contexts/OnboardingContext';
import { RefreshProvider } from './contexts/RefreshContext';
const OnboardingWizard = lazy(() => import('./components/onboarding/OnboardingWizard'));
const GlobalNotificationListener = lazy(() => import('./components/GlobalNotificationListener'));
import CometChatInitializer from './components/chat/CometChatInitializer';
import './App.css';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SkuReport = lazy(() => import('./pages/SkuReport'));
const ParentAsinReport = lazy(() => import('./pages/ParentAsinReport'));
const MonthWiseReport = lazy(() => import('./pages/MonthWiseReport'));
const AdsReport = lazy(() => import('./pages/AdsReport'));
const UploadExport = lazy(() => import('./pages/UploadExport'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const AlertRulesPage = lazy(() => import('./pages/AlertRulesPage'));
const RuleSetsPage = lazy(() => import('./pages/RuleSetsPage'));
const RulesetBuilderPage = lazy(() => import('./pages/RulesetBuilderPage'));
const ProfitLossPage = lazy(() => import('./pages/ProfitLossPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const AsinManagerPage = lazy(() => import('./pages/AsinManagerPage'));
const ActionsPage = lazy(() => import('./pages/ActionsPage.jsx'));
const SellerAsinTrackerPage = lazy(() => import('./pages/SellerAsinTrackerPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ScrapeTasksPage = lazy(() => import('./pages/ScrapeTasksPage'));
const SellersPage = lazy(() => import('./pages/SellersPage'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const GoalAchievementReport = lazy(() => import('./pages/GoalAchievementReport'));
const RevenueCalculatorPage = lazy(() => import('./pages/RevenueCalculatorPage'));
const TemplateManagerPage = lazy(() => import('./pages/TemplateManagerPage'));
const TasksOperationsPage = lazy(() => import('./pages/TasksOperationsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ChatContainer = lazy(() => import('./components/chat/ChatContainer'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'));
const FileManagerPage = lazy(() => import('./pages/FileManagerPage'));
const TeamManagementPage = lazy(() => import('./pages/TeamManagementPage'));

// Simple loading fallback
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: '100vh',
    background: '#f9fafb'
  }}>
    <div style={{
      width: 40,
      height: 40,
      border: '3px solid #e5e7eb',
      borderTopColor: '#6366f1',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Layout wrapper — flex row: Sidebar takes its own width, content fills the rest
function AppLayout({ children }) {
  return (
    <div className="app-shell">
      {/* Sidebar lives in the flex row — takes its own width (260px or 72px) */}
      <Sidebar />

      {/* Content fills the remaining space automatically */}
      <div className="content-wrapper">
        <Header />
        <main className="main-content">
          <div className="routes-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  const { showWizard, isLoading: onboardingLoading } = useOnboarding();

  if (loading || onboardingLoading) return null;

  return (
    <Suspense fallback={<PageLoader />}>
      {showWizard && <OnboardingWizard />}
      <GlobalNotificationListener />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />

        {/* Protected routes with sidebar + header layout */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<ProtectedRoute permission="dashboard_view"><Dashboard /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute permission="dashboard_view"><Dashboard /></ProtectedRoute>} />
                  <Route path="/sku-report" element={<ProtectedRoute permission="skureport_view"><SkuReport /></ProtectedRoute>} />
                  <Route path="/parent-asin-report" element={<ProtectedRoute permission="parentreport_view"><ParentAsinReport /></ProtectedRoute>} />
                  <Route path="/month-wise-report" element={<ProtectedRoute permission="monthlyreport_view"><MonthWiseReport /></ProtectedRoute>} />
                  <Route path="/ads-report" element={<ProtectedRoute permission="adsreport_view"><AdsReport /></ProtectedRoute>} />
                  <Route path="/asin-tracker" element={<ProtectedRoute permission="asinmanager_view"><AsinManagerPage /></ProtectedRoute>} />
                  <Route path="/profit-loss" element={<ProtectedRoute permission="pnlreport_view"><ProfitLossPage /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute permission="inventoryreport_view"><InventoryPage /></ProtectedRoute>} />
                  <Route path="/actions" element={<ProtectedRoute permission="actions_view"><ActionsPage /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute permission="users_view"><UsersPage /></ProtectedRoute>} />
                  <Route path="/roles" element={<ProtectedRoute permission="roles_view"><RolesPage /></ProtectedRoute>} />
                  <Route path="/team-management" element={<ProtectedRoute permission="roles_view"><TeamManagementPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute permission="dashboard_view"><SettingsPage /></ProtectedRoute>} />
                  <Route path="/api-keys" element={<ProtectedRoute permission="dashboard_view"><ApiKeysPage /></ProtectedRoute>} />
                  <Route path="/file-manager" element={<ProtectedRoute permission="files_manage"><FileManagerPage /></ProtectedRoute>} />
                  <Route path="/upload-export" element={<ProtectedRoute permission="asinmanager_import"><UploadExport /></ProtectedRoute>} />
                  <Route path="/alerts" element={<ProtectedRoute permission="dashboard_view"><AlertsPage /></ProtectedRoute>} />
                  <Route path="/alert-rules" element={<ProtectedRoute permission="rules_view"><AlertRulesPage /></ProtectedRoute>} />
                  <Route path="/rule-sets" element={<ProtectedRoute permission="rules_view"><RuleSetsPage /></ProtectedRoute>} />
                  <Route path="/rule-sets/new" element={<ProtectedRoute permission="rules_manage"><RulesetBuilderPage /></ProtectedRoute>} />
                  <Route path="/rule-sets/:id/edit" element={<ProtectedRoute permission="rules_manage"><RulesetBuilderPage /></ProtectedRoute>} />
                  <Route path="/scrape-tasks" element={<ProtectedRoute permission="scraping_view"><ScrapeTasksPage /></ProtectedRoute>} />
                  <Route path="/sellers" element={<ProtectedRoute permission="seller_view"><SellersPage /></ProtectedRoute>} />
                  <Route path="/seller-tracker" element={<ProtectedRoute permission="asintracker_view"><SellerAsinTrackerPage /></ProtectedRoute>} />
                  <Route path="/seller-tracker/:sellerId" element={<ProtectedRoute permission="asintracker_view"><SellerAsinTrackerPage /></ProtectedRoute>} />
                  <Route path="/activity-log" element={<ProtectedRoute permission="activitylogs_view"><ActivityLog /></ProtectedRoute>} />
                  <Route path="/actions/templates" element={<ProtectedRoute permission="actions_manage"><TemplateManagerPage /></ProtectedRoute>} />
                  <Route path="/actions/achievement-report" element={<ProtectedRoute permission="monthlyreport_view"><GoalAchievementReport /></ProtectedRoute>} />
                  <Route path="/revenue-calculator" element={<ProtectedRoute permission="calculator_view"><RevenueCalculatorPage /></ProtectedRoute>} />
                  <Route path="/tasks" element={<ProtectedRoute permission="dashboard_view"><TasksPage /></ProtectedRoute>} />

                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/:id" element={<ProfilePage />} />
                  <Route path="/chat" element={<ProtectedRoute permission="dashboard_view"><ChatContainer /></ProtectedRoute>} />
                  <Route path="/unauthorized" element={<Unauthorized />} />
                </Routes>
                </Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}



function App() {
  return (
    <CometChatInitializer>
      <RefreshProvider>
        <AuthProvider>
          <SocketProvider>
            <SidebarProvider>
              <DateRangeProvider>
                <PageTitleProvider>
                  <ToastProvider>
                    <OnboardingProvider>
                      <GlobalNotificationListener />
                      <AppRoutes />
                    </OnboardingProvider>
                  </ToastProvider>
                </PageTitleProvider>
              </DateRangeProvider>
            </SidebarProvider>
          </SocketProvider>
        </AuthProvider>
      </RefreshProvider>
    </CometChatInitializer>
  );
}

export default App;
