import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CrmProvider } from "@/contexts/CrmContext";
import ClientPageFallback from "@/components/client-portal/ClientPageFallback";
import NotFound from "./pages/NotFound";

// Eager: login + layout must be instant (no chunk delay on first render)
import ClientLogin from "./pages/client/ClientLogin";
import ClientLayout from "./components/client-portal/ClientLayout";

// Lazy: each page becomes its own chunk — only loaded when visited
const ClientDashboard       = lazy(() => import("./pages/client/ClientDashboard"));
const ClientProfile         = lazy(() => import("./pages/client/ClientProfile"));
const ClientContracts       = lazy(() => import("./pages/client/ClientContracts"));
const ClientDocuments       = lazy(() => import("./pages/client/ClientDocuments"));
const ClientProducts        = lazy(() => import("./pages/client/ClientProducts"));
const ClientProductDetail   = lazy(() => import("./pages/client/ClientProductDetail"));
const ClientSimulator       = lazy(() => import("./pages/client/ClientSimulator"));
const ClientTrading         = lazy(() => import("./pages/client/ClientTrading"));
const ClientTradingPlatform = lazy(() => import("./pages/client/ClientTradingPlatform"));
const ClientWithdrawal      = lazy(() => import("./pages/client/ClientWithdrawal"));
const ClientHistory         = lazy(() => import("./pages/client/ClientHistory"));
const ClientNews            = lazy(() => import("./pages/client/ClientNews"));
const ClientHelp            = lazy(() => import("./pages/client/ClientHelp"));
const ClientLinks           = lazy(() => import("./pages/client/ClientLinks"));
const ClientVersement       = lazy(() => import("./pages/client/ClientVersement"));

// Aggressive cache: data stays fresh for 3 min, GC at 15 min.
// Back-navigation reuses cached data with zero refetch delay.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const withSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<ClientPageFallback />}>{node}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CrmProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Routes>
            <Route path="/client/login" element={<ClientLogin />} />
            <Route path="/client/trading/platform" element={withSuspense(<ClientTradingPlatform />)} />
            <Route path="/client" element={<ClientLayout />}>
              <Route path="dashboard"           element={withSuspense(<ClientDashboard />)} />
              <Route path="profile"             element={withSuspense(<ClientProfile />)} />
              <Route path="contracts"           element={withSuspense(<ClientContracts />)} />
              <Route path="products"            element={withSuspense(<ClientProducts />)} />
              <Route path="products/:productId" element={withSuspense(<ClientProductDetail />)} />
              <Route path="trading"             element={withSuspense(<ClientTrading />)} />
              <Route path="simulator"           element={withSuspense(<ClientSimulator />)} />
              <Route path="documents"           element={withSuspense(<ClientDocuments />)} />
              <Route path="withdrawal"          element={withSuspense(<ClientWithdrawal />)} />
              <Route path="history"             element={withSuspense(<ClientHistory />)} />
              <Route path="news"                element={withSuspense(<ClientNews />)} />
              <Route path="help"                element={withSuspense(<ClientHelp />)} />
              <Route path="links"               element={withSuspense(<ClientLinks />)} />
              <Route path="versement"          element={withSuspense(<ClientVersement />)} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
            <Route path="/" element={<Navigate to="/client/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CrmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
