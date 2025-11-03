// src/App.tsx
import React, { useState, useEffect } from "react";
import {
  Outlet,
  Link,
  useLocation,
  Location,
  useNavigate,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "./supabaseClient";
import { Menu } from "lucide-react";
import { useAppData } from "./hooks/useAppData";
import { useTransactionTemplates } from "./hooks/useTransactionTemplates";
import MobileMenu from "./components/ui/MobileMenu";
import DuckFabNav from "./components/dashboard/DuckFabNav";

const navLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/transactions", label: "Transactions" },
  { to: "/budgets", label: "Budgets" },
  { to: "/settings", label: "Settings" },
];

const App: React.FC = () => {
  const appData = useAppData();
  const { templates } = useTransactionTemplates();
  const navigate = useNavigate();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(
    null
  );
  const [bgHeight, setBgHeight] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const handleSetEditingTransaction = (t: any) => setEditingTransaction(t);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
      setAuthChecked(true);
    };
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const handleResize = () => {
      const newHeight = document.body.scrollHeight;
      setBgHeight(newHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    const observer = new MutationObserver(handleResize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [location.pathname]);

  if (!authChecked || appData.loading) {
    return (
      <div className="relative h-screen w-full">
        <img
          src="/BankerQuack.png"
          alt="Loading"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <p className="text-4xl font-bold text-white animate-pulse">
            loading...
          </p>
        </div>
      </div>
    );
  }

  if (appData.error) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-red-500">
        Error: {appData.error}
      </div>
    );
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error logging out:", error.message);
    else navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#004D40] to-[#26A69A] text-gray-200">
      <div
        className="absolute top-0 left-0 w-full -z-10 bg-grid-white/[0.05]"
        style={{ height: bgHeight ? `${bgHeight}px` : "100%" }}
      />

      <main>
        <Outlet
          context={{
            ...appData,
            templates,
            editingTransaction,
            handleSetEditingTransaction,
            fabOpen,
          }}
        />
      </main>
      <DuckFabNav open={fabOpen} setOpen={setFabOpen} />
    </div>
  );
};

export default App;
