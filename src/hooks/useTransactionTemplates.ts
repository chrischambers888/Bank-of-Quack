import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/supabaseClient";
import { TransactionTemplate } from "@/types";

export const useTransactionTemplates = () => {
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setTemplates([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("transaction_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setTemplates(data || []);
    } catch (e: any) {
      setError(e.message);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (template: Partial<TransactionTemplate>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error: insertError } = await supabase
        .from("transaction_templates")
        .insert([{ ...template, user_id: user.id }])
        .select()
        .single();

      if (insertError) throw insertError;
      
      if (data) {
        setTemplates((prev) => [data, ...prev]);
      }
      
      return data;
    } catch (e: any) {
      alert(e.message);
      throw e;
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, template: Partial<TransactionTemplate>) => {
    try {
      const { data, error: updateError } = await supabase
        .from("transaction_templates")
        .update(template)
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      if (data) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? data : t))
        );
      }
      
      return data;
    } catch (e: any) {
      alert(e.message);
      throw e;
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("transaction_templates")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      alert(e.message);
      throw e;
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
};

