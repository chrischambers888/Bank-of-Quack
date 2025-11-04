// src/components/settings/ConnectedAccountsSettings.tsx
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/supabaseClient";
import { ConnectedAccount } from "@/types";
import { PlaidLinkButton } from "./PlaidLinkButton";
import { Trash2, RefreshCw, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ConnectedAccountsSettings() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [syncDaysBack, setSyncDaysBack] = useState<string>("7");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      console.error("Error fetching accounts:", error);
      alert("Error loading accounts: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSync = async (accountId: string) => {
    try {
      setSyncingAccountId(accountId);
      const { data, error } = await supabase.functions.invoke(
        "sync-plaid-transactions",
        {
          body: {
            account_id: accountId,
            days_back: parseInt(syncDaysBack) || 7,
          },
        }
      );

      if (error) throw error;

      if (data?.success) {
        alert(
          `Sync complete! Added ${data.synced} new transactions. ${
            data.skipped || 0
          } were already imported.`
        );
        // Update last_synced_at for the account
        await fetchAccounts();
      } else {
        throw new Error(data?.error || "Sync failed");
      }
    } catch (error: any) {
      console.error("Error syncing transactions:", error);
      alert("Error syncing transactions: " + error.message);
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      const { error } = await supabase
        .from("connected_accounts")
        .update({ is_active: false })
        .eq("id", accountToDelete);

      if (error) throw error;

      await fetchAccounts();
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    } catch (error: any) {
      console.error("Error deleting account:", error);
      alert("Error removing account: " + error.message);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/80">Loading accounts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/80">
            Connect your bank accounts to automatically import transactions
          </p>
          <PlaidLinkButton onSuccess={fetchAccounts} />
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            <p>No connected accounts yet.</p>
            <p className="text-sm mt-2">Click "Connect Bank Account" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="border border-white/20 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">
                      {account.account_name}
                    </h3>
                    <p className="text-sm text-white/60">
                      {account.institution_name}
                      {account.account_last_four && ` •••• ${account.account_last_four}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {account.account_type}
                      </Badge>
                      {account.needs_reauth && (
                        <Badge variant="destructive" className="text-xs">
                          Re-authentication Required
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAccountToDelete(account.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-sm text-white/60">
                  <p>Last synced: {formatDate(account.last_synced_at)}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={syncDaysBack}
                    onValueChange={setSyncDaysBack}
                  >
                    <SelectTrigger className="w-32 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="60">Last 60 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => handleSync(account.id)}
                    disabled={syncingAccountId === account.id}
                    size="sm"
                  >
                    {syncingAccountId === account.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync Transactions
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Connected Account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the account connection. Pending transactions from this account will remain, but no new transactions will be synced. You can reconnect this account anytime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
