import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, DollarSign, Star } from "lucide-react";

interface Stats {
  totalClients: number;
  totalPoints: number;
  totalBonus: number;
  activePromotions: number;
}

export const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data: clients } = await supabase.from("clients").select("pontos, bonus");

      const { data: promotions } = await supabase
        .from("promotions")
        .select("id")
        .eq("ativo", true);

      return {
        totalClients: clients?.length || 0,
        totalPoints: clients?.reduce((sum, c) => sum + c.pontos, 0) || 0,
        totalBonus: clients?.reduce((sum, c) => sum + parseFloat(c.bonus.toString()), 0) || 0,
        activePromotions: promotions?.length || 0,
      };
    },
    refetchInterval: 1000,        
    refetchOnWindowFocus: true,      
    refetchOnReconnect: true,        
  });

  const statCards = [
    {
      title: "Total de Clientes",
      value: stats?.totalClients || 0,
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Pontos Acumulados",
      value: (stats?.totalPoints || 0).toLocaleString("pt-BR"),
      icon: TrendingUp,
      color: "text-accent",
    },
    {
      title: "Bônus Concedidos",
      value: `R$ ${(stats?.totalBonus || 0).toFixed(2)}`,
      icon: DollarSign,
      color: "text-success",
    },
    {
      title: "Promoções Ativas",
      value: stats?.activePromotions || 0,
      icon: Star,
      color: "text-accent",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
