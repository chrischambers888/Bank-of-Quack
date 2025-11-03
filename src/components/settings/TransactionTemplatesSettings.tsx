import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { TransactionTemplate, Category } from "@/types";
import { useTransactionTemplates } from "@/hooks/useTransactionTemplates";
import TransactionTemplateForm from "./TransactionTemplateForm";
import { Pencil, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";

interface TransactionTemplatesSettingsProps {
  userNames: string[];
  categories: Category[];
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  expense: "Expense",
  income: "Income",
  settlement: "Settlement",
  reimbursement: "Reimbursement",
};

const TransactionTemplatesSettings: React.FC<
  TransactionTemplatesSettingsProps
> = ({ userNames, categories }) => {
  const {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useTransactionTemplates();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<TransactionTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] =
    useState<TransactionTemplate | null>(null);

  const handleCreateTemplate = async (template: Partial<TransactionTemplate>) => {
    await createTemplate(template);
  };

  const handleUpdateTemplate = async (template: Partial<TransactionTemplate>) => {
    if (!editingTemplate) return;
    await updateTemplate(editingTemplate.id, template);
    setEditingTemplate(null);
  };

  const handleEditClick = (template: TransactionTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (template: TransactionTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (templateToDelete) {
      deleteTemplate(templateToDelete.id);
      setTemplateToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
  };

  const handleFormSubmit = async (template: Partial<TransactionTemplate>) => {
    if (editingTemplate) {
      await handleUpdateTemplate(template);
    } else {
      await handleCreateTemplate(template);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading templates...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Transaction Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground text-sm">
                Create reusable transaction presets to quickly fill in the
                transaction form.
              </p>
              <Button onClick={() => setIsFormOpen(true)}>
                Create Template
              </Button>
            </div>

            {templates.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No templates created yet. Create one to get started!
              </p>
            ) : (
              <ul className="space-y-3">
                {templates.map((template) => (
                  <li
                    key={template.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-background/80 border"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{template.template_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          ({TRANSACTION_TYPE_LABELS[template.transaction_type] || template.transaction_type})
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          <strong>Amount:</strong> {formatMoney(template.amount)}
                        </span>
                        {template.transaction_type === "expense" &&
                          template.category_id && (
                            <span>
                              <strong>Category:</strong>{" "}
                              {
                                categories.find(
                                  (c) => c.id === template.category_id
                                )?.name
                              }
                            </span>
                          )}
                        {template.paid_by_user_name && (
                          <span>
                            <strong>Paid by:</strong> {template.paid_by_user_name}
                          </span>
                        )}
                        {template.paid_to_user_name && (
                          <span>
                            <strong>Paid to:</strong> {template.paid_to_user_name}
                          </span>
                        )}
                        {template.split_type && (
                          <span>
                            <strong>Split:</strong> {template.split_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(template)}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(template)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <TransactionTemplateForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        editingTemplate={editingTemplate}
        userNames={userNames}
        categories={categories}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogTrigger asChild />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the template "
              {templateToDelete?.template_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TransactionTemplatesSettings;

