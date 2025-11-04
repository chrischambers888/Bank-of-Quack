import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { Transaction, Category, Sector } from "@/types";

export const useAppData = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userNames, setUserNames] = useState<string[]>(["User 1", "User 2"]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [user1AvatarUrl, setUser1AvatarUrl] = useState<string | null>(null);
  const [user2AvatarUrl, setUser2AvatarUrl] = useState<string | null>(null);
  const [incomeImageUrl, setIncomeImageUrl] = useState<string | null>(null);
  const [settlementImageUrl, setSettlementImageUrl] = useState<string | null>(
    null
  );
  const [reimbursementImageUrl, setReimbursementImageUrl] = useState<
    string | null
  >(null);
  const [
    sectorCategoryEmptyStateImageUrl,
    setSectorCategoryEmptyStateImageUrl,
  ] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const addCategory = useCallback(async (name: string) => {
    if (!name) return;
    const { data, error } = await supabase
      .from("categories")
      .insert([{ name }])
      .select();
    if (error) return alert(error.message);
    if (data && data.length > 0) setCategories((prev) => [...prev, data[0]]);
  }, []);

  const deleteCategory = useCallback(async (cat: Category) => {
    if (!cat?.id) return;
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", cat.id);
    if (error) return alert(error.message);
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
  }, []);

  const addSector = useCallback(async (name: string) => {
    if (!name) return null;
    const { data, error } = await supabase
      .from("sectors")
      .insert([{ name }])
      .select();
    if (error) {
      alert(error.message);
      return null;
    }
    if (data && data.length > 0) {
      const newSector = { ...data[0], category_ids: [] };
      setSectors((prev) => [...prev, newSector]);
      return newSector;
    }
    return null;
  }, []);

  const deleteSector = useCallback(async (id: string) => {
    if (!id) return;
    const { error } = await supabase.from("sectors").delete().eq("id", id);
    if (error) return alert(error.message);
    setSectors((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addCategoryToSector = useCallback(
    async (sectorId: string, categoryId: string) => {
      if (!sectorId || !categoryId) return;
      const { error } = await supabase
        .from("sector_categories")
        .insert([{ sector_id: sectorId, category_id: categoryId }]);
      if (error) return alert(error.message);
      setSectors((prev) =>
        prev.map((s) =>
          s.id === sectorId
            ? { ...s, category_ids: [...(s.category_ids || []), categoryId] }
            : s
        )
      );
    },
    []
  );

  const removeCategoryFromSector = useCallback(
    async (sectorId: string, categoryId: string) => {
      if (!sectorId || !categoryId) return;
      const { error } = await supabase
        .from("sector_categories")
        .delete()
        .match({ sector_id: sectorId, category_id: categoryId });
      if (error) return alert(error.message);
      setSectors((prev) =>
        prev.map((s) =>
          s.id === sectorId
            ? {
                ...s,
                category_ids: (s.category_ids || []).filter(
                  (id: string) => id !== categoryId
                ),
              }
            : s
        )
      );
    },
    []
  );

  const updateUserNames = useCallback(async (n1: string, n2: string) => {
    await supabase
      .from("app_settings")
      .update({ value: n1 })
      .eq("key", "user1_name");
    await supabase
      .from("app_settings")
      .update({ value: n2 })
      .eq("key", "user2_name");
    setUserNames([n1, n2]);
  }, []);

  const addTransaction = useCallback(async (t: Partial<Transaction>) => {
    if (!t) return;
    
    // If transaction already has an ID, it was already inserted (e.g., from pending approval)
    // Just update local state without inserting to database
    if (t.id) {
      setTransactions((prev) => {
        // Check if transaction already exists to avoid duplicates
        if (prev.find((tr) => tr.id === t.id)) {
          return prev;
        }
        return [t as Transaction, ...prev];
      });
      return;
    }
    
    // Otherwise, insert new transaction
    const { data, error } = await supabase
      .from("transactions")
      .insert([t])
      .select();
    if (error) {
      alert(error.message);
      return;
    }
    if (data && data.length > 0) setTransactions((prev) => [data[0], ...prev]);
  }, []);

  const updateTransaction = useCallback(async (t: Partial<Transaction>) => {
    if (!t || !t.id) return;
    const { data, error } = await supabase
      .from("transactions")
      .update(t)
      .eq("id", t.id)
      .select();
    if (error) {
      alert(error.message);
      return;
    }
    if (data && data.length > 0) {
      setTransactions((prev) =>
        prev.map((tr) => (tr.id === t.id ? { ...tr, ...data[0] } : tr))
      );
    }
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!id) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateCategory = useCallback(async (id: string, name: string) => {
    if (!id || !name) return;
    const { data, error } = await supabase
      .from("categories")
      .update({ name })
      .eq("id", id)
      .select();
    if (error) return alert(error.message);
    if (data && data.length > 0) {
      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? { ...cat, ...data[0] } : cat))
      );
    }
  }, []);

  const updateSector = useCallback(async (id: string, name: string) => {
    if (!id || !name) return;
    const { data, error } = await supabase
      .from("sectors")
      .update({ name })
      .eq("id", id)
      .select();
    if (error) return alert(error.message);
    if (data && data.length > 0) {
      setSectors((prev) =>
        prev.map((sec) => (sec.id === id ? { ...sec, ...data[0] } : sec))
      );
    }
  }, []);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        let { data: appSettings, error: settingsError } = await supabase
          .from("app_settings")
          .select("key, value");
        if (settingsError) throw settingsError;
        let fetchedUser1Name = "User 1",
          fetchedUser2Name = "User 2";
        let fetchedUser1AvatarUrl = null,
          fetchedUser2AvatarUrl = null;
        if (appSettings) {
          const u1 = appSettings.find((s: any) => s.key === "user1_name");
          const u2 = appSettings.find((s: any) => s.key === "user2_name");
          const u1Avatar = appSettings.find(
            (s: any) => s.key === "user1_avatar_url"
          );
          const u2Avatar = appSettings.find(
            (s: any) => s.key === "user2_avatar_url"
          );
          const emptyStateImg = appSettings.find(
            (s: any) => s.key === "sector_category_empty_state_image_url"
          );
          const incomeImg = appSettings.find(
            (s: any) => s.key === "income_image_url"
          );
          const settlementImg = appSettings.find(
            (s: any) => s.key === "settlement_image_url"
          );
          const reimbursementImg = appSettings.find(
            (s: any) => s.key === "reimbursement_image_url"
          );
          if (u1) fetchedUser1Name = u1.value;
          if (u2) fetchedUser2Name = u2.value;
          if (u1Avatar) fetchedUser1AvatarUrl = u1Avatar.value;
          if (u2Avatar) fetchedUser2AvatarUrl = u2Avatar.value;
          if (emptyStateImg)
            setSectorCategoryEmptyStateImageUrl(emptyStateImg.value);
          if (incomeImg) setIncomeImageUrl(incomeImg.value);
          if (settlementImg) setSettlementImageUrl(settlementImg.value);
          if (reimbursementImg)
            setReimbursementImageUrl(reimbursementImg.value);
        }
        setUserNames([fetchedUser1Name, fetchedUser2Name]);
        setUser1AvatarUrl(fetchedUser1AvatarUrl);
        setUser2AvatarUrl(fetchedUser2AvatarUrl);

        let { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("id, name, image_url")
          .order("name", { ascending: true });
        if (categoriesError) throw categoriesError;

        let { data: sectorsData, error: sectorsError } = await supabase
          .from("sectors")
          .select("id, name")
          .order("name", { ascending: true });
        if (sectorsError) throw sectorsError;

        let { data: sectorCategoriesData, error: sectorCategoriesError } =
          await supabase
            .from("sector_categories")
            .select("sector_id, category_id");
        if (sectorCategoriesError) throw sectorCategoriesError;

        const sectorsWithCategories = (sectorsData || []).map((s) => ({
          ...s,
          category_ids: (sectorCategoriesData || [])
            .filter((sc) => sc.sector_id === s.id)
            .map((sc) => sc.category_id),
        }));

        let { data: transactionsData, error: transactionsError } =
          await supabase
            .from("transactions_view")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });
        if (transactionsError) throw transactionsError;

        setCategories(categoriesData || []);
        setSectors(sectorsWithCategories || []);
        setTransactions(transactionsData || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return {
    transactions,
    setTransactions,
    userNames,
    updateUserNames,
    categories,
    setCategories,
    addCategory,
    deleteCategory,
    updateCategory,
    sectors,
    setSectors,
    addSector,
    deleteSector,
    updateSector,
    addCategoryToSector,
    removeCategoryFromSector,
    user1AvatarUrl,
    user2AvatarUrl,
    sectorCategoryEmptyStateImageUrl,
    incomeImageUrl,
    settlementImageUrl,
    reimbursementImageUrl,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
};
