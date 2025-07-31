import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface DeleteBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sectorName: string;
  deleteCategoryBudgets: boolean;
  onDeleteCategoryBudgetsChange: (checked: boolean) => void;
}

export function DeleteBudgetDialog({
  isOpen,
  onClose,
  onConfirm,
  sectorName,
  deleteCategoryBudgets,
  onDeleteCategoryBudgetsChange,
}: DeleteBudgetDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Delete Sector Budget
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Are you sure you want to delete the budget for "{sectorName}"?
          </p>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="delete-category-budgets"
              checked={deleteCategoryBudgets}
              onCheckedChange={(checked) =>
                onDeleteCategoryBudgetsChange(checked as boolean)
              }
            />
            <Label
              htmlFor="delete-category-budgets"
              className="text-sm text-foreground"
            >
              Also delete all category budgets in this sector
            </Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
