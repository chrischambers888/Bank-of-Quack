// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App"; // Our main App component
import "./global.css";

// 1. Import necessary things from 'react-router-dom'
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

// 2. Import your page components
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import SettingsPage from "./pages/SettingsPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import PendingTransactionsPage from "./pages/PendingTransactionsPage";

import LoginPage from "./pages/LoginPage";

// 3. Define the router configuration
const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/", // The main path for our application
    element: <App />, // The App component will render for this path AND its children
    children: [
      // These are "nested" routes that will render inside App's <Outlet />
      {
        index: true, // This is the default child route for '/'
        element: <DashboardPage />,
      },
      {
        path: "transactions", // Corresponds to '/transactions'
        element: <TransactionsPage />,
      },
      {
        path: "transactions/:transactionId", // Corresponds to '/transactions/:id' for editing
        element: <TransactionsPage />,
      },
      {
        path: "settings", // Corresponds to '/settings'
        element: <SettingsPage />,
      },
      {
        path: "budgets", // Corresponds to '/budgets'
        element: <BudgetsPage />,
      },
      {
        path: "pending", // Corresponds to '/pending'
        element: <PendingTransactionsPage />,
      },
    ],
  },
  // You could define other top-level paths here, e.g., an auth section
  // { path: '/login', element: <LoginPage /> }
]);

// 4. Provide the router to your application
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  </React.StrictMode>
);
