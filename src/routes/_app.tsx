import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="app-shell min-h-screen pb-nav">
      <div className="app-mesh" aria-hidden />
      <div className="relative z-10 max-w-md mx-auto">
        <Outlet />
      </div>
      <BottomNav />
      <ChatbotWidget />
    </div>
  );
}
