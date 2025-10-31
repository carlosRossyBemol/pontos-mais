import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Store } from "lucide-react";
import { Dashboard } from "@/components/Dashboard";
import { RegisterPurchase } from "@/components/RegisterPurchase";
import { WithdrawBonus } from "@/components/WithdrawBonus";
import { ClientsList } from "@/components/ClientsList";
import { TransactionHistory } from "@/components/TransactionHistory";
import { PromotionsManager } from "@/components/PromotionsManager";

const Index = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    } else {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Ferragens Natal</h1>
              <p className="text-sm font-medium text-accent">Pontos+</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="space-y-5">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="dashboard" className="text-base py-3">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="compra" className="text-base py-3">
              Compra
            </TabsTrigger>
            <TabsTrigger value="retirada" className="text-base py-3">
              Retirada
            </TabsTrigger>
            <TabsTrigger value="clientes" className="text-base py-3">
              Clientes
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-base py-3">
              Histórico
            </TabsTrigger>
            {/* <TabsTrigger value="promocoes" className="text-base py-3">
              Promoções
            </TabsTrigger> */}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard />
          </TabsContent>

          <TabsContent value="compra">
            <RegisterPurchase />
          </TabsContent>

          <TabsContent value="retirada">
            <WithdrawBonus />
          </TabsContent>

          <TabsContent value="clientes">
            <ClientsList />
          </TabsContent>

          <TabsContent value="historico">
            <TransactionHistory />
          </TabsContent>

          <TabsContent value="promocoes">
            <PromotionsManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;