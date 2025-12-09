import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletContextProvider } from "@/contexts/WalletContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Layout } from "@/components/layout/Layout";
import { UsernameEnforcer } from "@/components/UsernameEnforcer";
import Index from "./pages/Index";
import Arena from "./pages/Arena";
import MyWagers from "./pages/MyWagers";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletContextProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <UsernameEnforcer>
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/arena" element={<Arena />} />
                <Route path="/my-wagers" element={<MyWagers />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </UsernameEnforcer>
        </BrowserRouter>
      </TooltipProvider>
    </WalletContextProvider>
  </QueryClientProvider>
);

export default App;
