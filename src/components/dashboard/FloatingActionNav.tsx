import React, { useState } from "react";
import { Plus, Home, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  {
    label: "Dashboard",
    icon: <Home className="w-5 h-5 mr-2" />,
    to: "/",
  },
  {
    label: "New Transaction",
    icon: <Plus className="w-5 h-5 mr-2" />,
    to: "/transactions",
  },
  {
    label: "Settings",
    icon: <SettingsIcon className="w-5 h-5 mr-2" />,
    to: "/settings",
  },
];

const FloatingActionNav: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNav = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 z-10 rounded-full p-0 w-14 h-14 shadow-lg bg-primary text-white sm:hidden flex items-center justify-center text-3xl hover:bg-primary/90 transition-all"
          aria-label="Open navigation menu"
        >
          <Plus className="w-8 h-8" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-w-full w-full rounded-t-2xl border-t border-border shadow-2xl p-6 pb-10 bg-background sm:hidden flex flex-col items-center"
      >
        <SheetHeader>
          <SheetTitle>Navigate</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 mt-4 w-full">
          {NAV_LINKS.map((link) => (
            <Button
              key={link.to}
              variant="outline"
              className="w-full flex items-center justify-start text-lg"
              onClick={() => handleNav(link.to)}
            >
              {link.icon}
              {link.label}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FloatingActionNav;
