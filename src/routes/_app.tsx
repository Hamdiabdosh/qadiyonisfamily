import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { BuiltByRaafatI18n } from "@/components/brand/built-by-raafat";
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
        <footer className="px-4 pb-2 pt-6 text-center">
          <BuiltByRaafatI18n />
        </footer>
      </div>
      <BottomNav />
      <ChatbotWidget />
    </div>
  );
}
