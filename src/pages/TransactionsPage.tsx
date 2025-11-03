// src/pages/TransactionsPage.tsx
import React from "react"; // Added React import for clarity, though often implicit
import { useOutletContext, useParams } from "react-router-dom";
import TransactionForm from "../components/TransactionForm";
import DuckFabNav from "@/components/dashboard/DuckFabNav";
import { Transaction, Category } from "@/types";

interface TransactionsPageContext {
  userNames: string[];
  categories: Category[];
  transactions: Transaction[];
  editingTransaction: Transaction | null;
  addTransaction: (t: Partial<Transaction>) => void;
  updateTransaction: (t: Partial<Transaction>) => void;
  handleSetEditingTransaction: (t: Transaction | null) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const TransactionsPage: React.FC = () => {
  // Get the full context from Outlet
  const context = useOutletContext<TransactionsPageContext>();
  const { transactionId } = useParams<{ transactionId?: string }>();

  // Set the editing transaction based on URL parameter
  React.useEffect(() => {
    if (
      transactionId &&
      context.transactions &&
      context.handleSetEditingTransaction
    ) {
      const transaction = context.transactions.find(
        (t) => t.id === transactionId
      );
      if (transaction) {
        context.handleSetEditingTransaction(transaction);
      }
    } else if (!transactionId && context.handleSetEditingTransaction) {
      // Clear editing transaction when navigating to /transactions without an ID (creating new transaction)
      context.handleSetEditingTransaction(null);
    }
  }, [
    transactionId,
    context.transactions,
    context.handleSetEditingTransaction,
  ]);

  // Simple fallback to check localStorage if editingTransaction is not in context
  React.useEffect(() => {
    if (!context.editingTransaction && context.handleSetEditingTransaction) {
      const storedTransaction = localStorage.getItem("editingTransaction");
      if (storedTransaction) {
        try {
          const transaction = JSON.parse(storedTransaction);
          context.handleSetEditingTransaction(transaction);
          localStorage.removeItem("editingTransaction"); // Clean up
        } catch (error) {
          console.error("Error parsing stored transaction:", error);
          localStorage.removeItem("editingTransaction"); // Clean up invalid data
        }
      }
    }
  }, [context.editingTransaction, context.handleSetEditingTransaction]);

  return (
    <>
      <div
        className="min-h-[calc(100vh-0px)] flex flex-col md:justify-center md:items-center md:min-h-[calc(100vh-0px)]" // vertical + horizontal centering on md+
      >
        <div className="max-w-4xl mx-auto w-full p-4">
          {/* The TransactionForm will dynamically change its title and behavior 
              based on whether `editingTransaction` is set in the context */}
          <TransactionForm
            userNames={context.userNames}
            categories={context.categories}
            transactions={context.transactions}
            editingTransaction={context.editingTransaction}
            addTransaction={context.addTransaction}
            updateTransaction={context.updateTransaction}
            handleSetEditingTransaction={context.handleSetEditingTransaction}
          />
        </div>
      </div>
      <DuckFabNav open={context.open} setOpen={context.setOpen} />
    </>
  );
};

export default TransactionsPage;
