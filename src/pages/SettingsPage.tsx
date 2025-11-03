// src/pages/SettingsPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../supabaseClient";
import DuckFabNav from "@/components/dashboard/DuckFabNav";

import UserSettings from "@/components/settings/UserSettings";
import TransactionTypeImagesSettings from "@/components/settings/TransactionTypeImagesSettings";
import EmptyStateImageSettings from "@/components/settings/EmptyStateImageSettings";
import CategorySettings from "@/components/settings/CategorySettings";
import SectorSettings from "@/components/settings/SectorSettings";
import SectorCategoryManagement from "@/components/settings/SectorCategoryManagement";
import TransactionManagement from "@/components/settings/TransactionManagement";
import TransactionTemplatesSettings from "@/components/settings/TransactionTemplatesSettings";
import { BudgetSettings } from "@/components/settings/BudgetSettings";
import ImportDialog from "@/components/settings/ImportDialog";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  transaction_type: string;
  category_id?: string;
  category_name?: string;
  paid_by_user_name?: string;
  split_type?: string;
  paid_to_user_name?: string;
  reimburses_transaction_id?: string;
}

interface SettingsPageContext {
  userNames: string[];
  updateUserNames: (n1: string, n2: string) => void;
  categories: any[];
  addCategory: (name: string) => void;
  deleteCategory: (cat: any) => void;
  sectors: any[];
  addSector: (name: string) => Promise<any | null>;
  deleteSector: (id: string) => void;
  addCategoryToSector: (sectorId: string, categoryId: string) => void;
  removeCategoryFromSector: (sectorId: string, categoryId: string) => void;
  setCategories?: any;
  updateCategory?: any;
  updateSector?: any;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  fetchTemplates?: () => Promise<void>;
}

const SettingsPage = () => {
  const context = useOutletContext<SettingsPageContext>();

  const [user1ImageUrl, setUser1ImageUrl] = useState<string | null>(null);
  const [user2ImageUrl, setUser2ImageUrl] = useState<string | null>(null);
  const [emptyStateImageUrl, setEmptyStateImageUrl] = useState<string | null>(
    null
  );
  const [incomeImageUrl, setIncomeImageUrl] = useState<string | null>(null);
  const [settlementImageUrl, setSettlementImageUrl] = useState<string | null>(
    null
  );
  const [reimbursementImageUrl, setReimbursementImageUrl] = useState<
    string | null
  >(null);
  const [isImportDialogOpen, setImportDialogOpen] = useState(false);
  const [isFabOpen, setFabOpen] = useState(false);

  const {
    userNames,
    updateUserNames,
    categories,
    addCategory,
    deleteCategory,
    sectors,
    addSector,
    deleteSector,
    addCategoryToSector,
    removeCategoryFromSector,
    setCategories,
    updateCategory,
    updateSector,
    transactions,
    setTransactions,
  } = context;

  const getExpenseSplitTypes = (currentUsers: string[]) => {
    if (!currentUsers || currentUsers.length < 2)
      return [{ value: "splitEqually", label: "Split Equally" }];
    return [
      { value: "splitEqually", label: "Split Equally" },
      { value: "user1_only", label: `For ${currentUsers[0]} Only` },
      { value: "user2_only", label: `For ${currentUsers[1]} Only` },
    ];
  };

  const splitTypeOptions = useMemo(
    () => getExpenseSplitTypes(userNames),
    [userNames]
  );

  const getSplitTypeLabel = useCallback(
    (value: string) => {
      const option = splitTypeOptions.find((opt) => opt.value === value);
      return option ? option.label : value;
    },
    [splitTypeOptions]
  );

  const getSplitTypeValueFromLabel = useCallback(
    (label: string) => {
      const option = splitTypeOptions.find((opt) => opt.label === label);
      return option ? option.value : label;
    },
    [splitTypeOptions]
  );

  const refetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, image_url")
      .order("name", { ascending: true });
    if (!error && typeof setCategories === "function") {
      setCategories(data || []);
    }
  }, [setCategories]);

  useEffect(() => {
    const fetchAvatars = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["user1_avatar_url", "user2_avatar_url"]);
      if (data) {
        const u1 = data.find((s: any) => s.key === "user1_avatar_url");
        const u2 = data.find((s: any) => s.key === "user2_avatar_url");
        if (u1 && u1.value) setUser1ImageUrl(u1.value);
        if (u2 && u2.value) setUser2ImageUrl(u2.value);
      }
    };
    fetchAvatars();
  }, [userNames]);

  useEffect(() => {
    const fetchEmptyStateImage = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "sector_category_empty_state_image_url")
        .single();
      if (data && data.value) setEmptyStateImageUrl(data.value);
    };
    fetchEmptyStateImage();
  }, []);

  useEffect(() => {
    const fetchTransactionTypeImages = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "income_image_url",
          "settlement_image_url",
          "reimbursement_image_url",
        ]);
      if (data) {
        const income = data.find((s: any) => s.key === "income_image_url");
        const settlement = data.find(
          (s: any) => s.key === "settlement_image_url"
        );
        const reimbursement = data.find(
          (s: any) => s.key === "reimbursement_image_url"
        );
        if (income && income.value) setIncomeImageUrl(income.value);
        if (settlement && settlement.value)
          setSettlementImageUrl(settlement.value);
        if (reimbursement && reimbursement.value)
          setReimbursementImageUrl(reimbursement.value);
      }
    };
    fetchTransactionTypeImages();
  }, []);

  if (!context) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className="max-w-3xl mx-auto w-full p-4 space-y-8">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>

        <UserSettings
          userNames={userNames}
          updateUserNames={updateUserNames}
          user1ImageUrl={user1ImageUrl}
          setUser1ImageUrl={setUser1ImageUrl}
          user2ImageUrl={user2ImageUrl}
          setUser2ImageUrl={setUser2ImageUrl}
        />

        <TransactionTypeImagesSettings
          initialIncomeImageUrl={incomeImageUrl}
          initialSettlementImageUrl={settlementImageUrl}
          initialReimbursementImageUrl={reimbursementImageUrl}
        />

        <EmptyStateImageSettings
          initialEmptyStateImageUrl={emptyStateImageUrl}
        />

        <CategorySettings
          categories={categories}
          addCategory={addCategory}
          deleteCategory={deleteCategory}
          updateCategory={updateCategory}
          refetchCategories={refetchCategories}
          sectors={sectors}
        />

        <SectorSettings
          sectors={sectors}
          addSector={addSector}
          deleteSector={deleteSector}
          updateSector={updateSector}
        />

        <SectorCategoryManagement
          sectors={sectors}
          categories={categories}
          addCategoryToSector={addCategoryToSector}
          removeCategoryFromSector={removeCategoryFromSector}
        />

        <BudgetSettings />

        <TransactionTemplatesSettings
          userNames={userNames}
          categories={categories}
          onTemplatesChange={context.fetchTemplates}
        />

        <TransactionManagement
          transactions={transactions}
          categories={categories}
          getSplitTypeLabel={getSplitTypeLabel}
          onImportClick={() => setImportDialogOpen(true)}
        />
      </div>

      <DuckFabNav open={isFabOpen} setOpen={setFabOpen} />

      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        userNames={userNames}
        categories={categories}
        transactions={transactions}
        setTransactions={setTransactions}
        splitTypeOptions={splitTypeOptions}
        getSplitTypeLabel={getSplitTypeLabel}
        getSplitTypeValueFromLabel={getSplitTypeValueFromLabel}
      />
    </>
  );
};

export default SettingsPage;
