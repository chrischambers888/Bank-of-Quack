import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BudgetForm } from "@/components/settings/BudgetForm";
import { BudgetCard } from "@/components/settings/BudgetCard";
import { Category, BudgetSummary, CategoryBudget } from "@/types";
import { supabase } from "@/supabaseClient";
import { Plus, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";

export function BudgetsPage() {
  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [editingBudget, setEditingBudget] = useState<CategoryBudget | null>(
    null
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Load budget summaries
      const { data: budgetData, error: budgetError } = await supabase
        .from("budget_summary")
        .select("*")
        .order("category_name");

      if (budgetError) throw budgetError;
      setBudgetSummaries(budgetData || []);
    } catch (error) {
      console.error("Error loading budget data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBudget = (category: Category) => {
    setSelectedCategory(category);
    setEditingBudget(null);
    setIsFormOpen(true);
  };

  const handleEditBudget = (budget: CategoryBudget) => {
    const category = categories.find((c) => c.id === budget.category_id);
    if (category) {
      setSelectedCategory(category);
      setEditingBudget(budget);
      setIsFormOpen(true);
    }
  };

  const handleSaveBudget = async () => {
    // Add a small delay to ensure database triggers have time to execute
    await new Promise((resolve) => setTimeout(resolve, 500));
    await loadData();
    setIsFormOpen(false);
    setSelectedCategory(null);
    setEditingBudget(null);
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      const { error } = await supabase
        .from("category_budgets")
        .delete()
        .eq("id", budgetId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error("Error deleting budget:", error);
      alert("Error deleting budget. Please try again.");
    }
  };

  const getBudgetStats = () => {
    const activeBudgets = budgetSummaries.filter((b) => b.budget_id); // Only consider budgets that actually exist
    const totalBudget = activeBudgets.reduce((sum, b) => {
      const budget =
        b.budget_type === "absolute"
          ? b.absolute_amount
          : (b.user1_amount || 0) + (b.user2_amount || 0);
      return sum + (budget || 0);
    }, 0);

    const totalSpent = activeBudgets.reduce(
      (sum, b) => sum + (b.current_period_spent || 0),
      0
    );
    const totalRemaining = totalBudget - totalSpent;
    const overallPercentage =
      totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return { totalBudget, totalSpent, totalRemaining, overallPercentage };
  };

  const stats = getBudgetStats();

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading budgets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">
            Manage your monthly spending budgets
          </p>
        </div>
      </div>

      {/* Budget Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalBudget.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">This month's budget</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalSpent.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.overallPercentage.toFixed(1)}% of budget used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.totalRemaining < 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              ${stats.totalRemaining.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalRemaining < 0 ? "Over budget" : "Available"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Category Budgets</h2>
          <Dialog
            open={isFormOpen && !selectedCategory}
            onOpenChange={setIsFormOpen}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedCategory(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
              <DialogHeader>
                <DialogTitle>Add New Budget</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant="outline"
                      className="h-auto p-3 flex flex-col items-center space-y-2 bg-card border-border text-foreground hover:bg-muted"
                      onClick={() => handleCreateBudget(category)}
                    >
                      {category.image_url && (
                        <img
                          src={category.image_url}
                          alt={category.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <span className="text-sm">{category.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Budget Form Dialog (for editing or after picking a category) */}
        {isFormOpen && selectedCategory && (
          <Dialog
            open={isFormOpen && !!selectedCategory}
            onOpenChange={setIsFormOpen}
          >
            <DialogContent className="max-w-md bg-gradient-to-b from-[#004D40] to-[#26A69A]">
              <BudgetForm
                category={selectedCategory}
                existingBudget={editingBudget || undefined}
                onSave={handleSaveBudget}
                onCancel={() => {
                  setIsFormOpen(false);
                  setSelectedCategory(null);
                  setEditingBudget(null);
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Budget Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetSummaries
            .filter((budgetSummary) => budgetSummary.budget_id) // Only show categories with actual budgets
            .map((budgetSummary) => (
              <BudgetCard
                key={budgetSummary.category_id}
                budgetSummary={budgetSummary}
                onEdit={handleEditBudget}
                onDelete={(budgetId) => setDeletingBudgetId(budgetId)}
              />
            ))}
        </div>

        {/* Empty State */}
        {budgetSummaries.filter((b) => b.budget_id).length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No budgets configured
              </h3>
              <p className="text-muted-foreground mb-4">
                Create budgets for your categories to track monthly spending
              </p>
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Budget
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingBudgetId}
        onOpenChange={() => setDeletingBudgetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this budget? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingBudgetId) {
                  handleDeleteBudget(deletingBudgetId);
                  setDeletingBudgetId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
