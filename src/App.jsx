import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { PageTitleProvider } from './contexts/PageTitleContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Sidebar from './components/common/Sidebar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import SkuReport from './pages/SkuReport';
import ParentAsinReport from './pages/ParentAsinReport';
import MonthWiseReport from './pages/MonthWiseReport';
import AdsReport from './pages/AdsReport';
import UploadExport from './pages/UploadExport';
import AlertsPage from './pages/AlertsPage';
import AlertRulesPage from './pages/AlertRulesPage';
import ProfitLossPage from './pages/ProfitLossPage';
import InventoryPage from './pages/InventoryPage';
import AsinManagerPage from './pages/AsinManagerPage';
import ActionsPage from './pages/ActionsPage.jsx';
import SellerAsinTrackerPage from './pages/SellerAsinTrackerPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import ScrapeTasksPage from './pages/ScrapeTasksPage';
import SellersPage from './pages/SellersPage';
import ActivityLog from './pages/ActivityLog';
import GoalAchievementReport from './pages/GoalAchievementReport';
import RevenueCalculatorPage from './pages/RevenueCalculatorPage';
import TemplateManagerPage from './pages/TemplateManagerPage';
import TasksOperationsPage from './pages/TasksOperationsPage';
import ProfilePage from './pages/ProfilePage';
import ChatContainer from './components/chat/ChatContainer';
import Unauthorized from './pages/Unauthorized';
import RolesPage from './pages/RolesPage';
import ApiKeysPage from './pages/ApiKeysPage';
import FileManagerPage from './pages/FileManagerPage';
import TeamManagementPage from './pages/TeamManagementPage';
import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './contexts/ToastContext';
import { OnboardingProvider, useOnboarding } from './contexts/OnboardingContext';
import OnboardingWizard from './components/onboarding/OnboardingWizard';
import GlobalNotificationListener from './components/GlobalNotificationListener';
import './App.css';

// Layout wrapper — flex row: Sidebar takes its own width, content fills the rest
function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar lives in the flex row — takes its own width (260px or 72px) */}
      <Sidebar />

      {/* Content fills the remaining space automatically */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
      >
        <Header />
        <main className="main-content" style={{ flex: 1 }}>
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
    <>
      {showWizard && <OnboardingWizard />}
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
                <Routes>
                  <Route path="/" element={<ProtectedRoute permission="dashboard_view"><Dashboard /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute permission="dashboard_view"><Dashboard /></ProtectedRoute>} />
                  <Route path="/sku-report" element={<ProtectedRoute permission="reports_sku_view"><SkuReport /></ProtectedRoute>} />
                  <Route path="/parent-asin-report" element={<ProtectedRoute permission="reports_parent_view"><ParentAsinReport /></ProtectedRoute>} />
                  <Route path="/month-wise-report" element={<ProtectedRoute permission="reports_monthly_view"><MonthWiseReport /></ProtectedRoute>} />
                  <Route path="/ads-report" element={<ProtectedRoute permission="reports_ads_view"><AdsReport /></ProtectedRoute>} />
                  <Route path="/asin-tracker" element={<ProtectedRoute permission="sellers_view"><AsinManagerPage /></ProtectedRoute>} />
                  <Route path="/profit-loss" element={<ProtectedRoute permission="reports_profit_view"><ProfitLossPage /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute permission="reports_inventory_view"><InventoryPage /></ProtectedRoute>} />
                  <Route path="/actions" element={<ProtectedRoute permission="actions_view"><ActionsPage /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute permission="users_view"><UsersPage /></ProtectedRoute>} />
                  <Route path="/roles" element={<ProtectedRoute permission="roles_view"><RolesPage /></ProtectedRoute>} />
                  <Route path="/team-management" element={<ProtectedRoute permission="roles_view"><TeamManagementPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute permission="settings_view"><SettingsPage /></ProtectedRoute>} />
                  <Route path="/api-keys" element={<ProtectedRoute permission="settings_view"><ApiKeysPage /></ProtectedRoute>} />
                  <Route path="/file-manager" element={<ProtectedRoute permission="dashboard_view"><FileManagerPage /></ProtectedRoute>} />
                  <Route path="/upload-export" element={<ProtectedRoute permission="sellers_manage_asins"><UploadExport /></ProtectedRoute>} />
                  <Route path="/alerts" element={<ProtectedRoute permission="dashboard_view"><AlertsPage /></ProtectedRoute>} />
                  <Route path="/alert-rules" element={<ProtectedRoute permission="settings_view"><AlertRulesPage /></ProtectedRoute>} />
                  <Route path="/scrape-tasks" element={<ProtectedRoute permission="scraping_view"><ScrapeTasksPage /></ProtectedRoute>} />
                   <Route path="/sellers" element={<ProtectedRoute permission="sellers_view"><SellersPage /></ProtectedRoute>} />
                  <Route path="/seller-tracker" element={<ProtectedRoute permission="sellers_view"><SellerAsinTrackerPage /></ProtectedRoute>} />
                  <Route path="/seller-tracker/:sellerId" element={<ProtectedRoute permission="sellers_view"><SellerAsinTrackerPage /></ProtectedRoute>} />
                  <Route path="/activity-log" element={<ProtectedRoute permission="settings_view"><ActivityLog /></ProtectedRoute>} />
                  <Route path="/actions/templates" element={<ProtectedRoute permission="actions_manage"><TemplateManagerPage /></ProtectedRoute>} />
                  <Route path="/actions/achievement-report" element={<ProtectedRoute permission="reports_monthly_view"><GoalAchievementReport /></ProtectedRoute>} />
                  <Route path="/revenue-calculator" element={<ProtectedRoute permission="calculator_view"><RevenueCalculatorPage /></ProtectedRoute>} />
                   
                   <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/:id" element={<ProfilePage />} />
                  <Route path="/chat" element={<ChatContainer />} />
                  <Route path="/unauthorized" element={<Unauthorized />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <SidebarProvider>
          <PageTitleProvider>
            <ToastProvider>
              <OnboardingProvider>
                <GlobalNotificationListener />
                <AppRoutes />
              </OnboardingProvider>
            </ToastProvider>
          </PageTitleProvider>
        </SidebarProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
