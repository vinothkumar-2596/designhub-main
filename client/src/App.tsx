import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalSearchProvider } from "@/contexts/GlobalSearchContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NewRequest from "./pages/NewRequest";
import Tasks from "./pages/Tasks";
import DesignerAvailability from "./pages/DesignerAvailability";
import MyRequests from "./pages/MyRequests";
import Approvals from "./pages/Approvals";
import TaskDetail from "./pages/TaskDetail";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import AIMode from "./pages/AIMode";
import WhatsAppTemplates from "./pages/WhatsAppTemplates";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GlobalSearchProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/new-request" element={<NewRequest />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/designer-availability" element={<DesignerAvailability />} />
              <Route path="/my-requests" element={<MyRequests />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/task/:id" element={<TaskDetail />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/ai-mode" element={<AIMode />} />
              <Route path="/help" element={<Help />} />
              <Route path="/whatsapp-templates" element={<WhatsAppTemplates />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </GlobalSearchProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
