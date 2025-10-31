import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Star, Trash2, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Promotion {
  id: string;
  nome: string;
  multiplicador: number;
  ativo: boolean;
  inicio: string | null;
  fim: string | null;
}

const PROMOTIONS_KEY = ["promotions-manager"];

export const PromotionsManager = () => {
  const [nome, setNome] = useState("");
  const [multiplicador, setMultiplicador] = useState("2");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const showError = (error: any) =>
    toast({
      title: "❌ Erro",
      description: error.message,
      variant: "destructive",
    });

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: PROMOTIONS_KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from("promotions")
        .select("*")
        .order("ativo", { ascending: false })
        .order("created_at", { ascending: false });

      if (!data) return [];

      const now = new Date();

      const promotionsWithLocalTime = data.map((promo) => {
        const inicioDate = promo.inicio ? new Date(promo.inicio) : null;
        const fimDate = promo.fim ? new Date(promo.fim) : null;

        // auto-desativa se passou da data fim
        const ativoCorrigido = fimDate && fimDate < now ? false : promo.ativo;

        return {
          ...promo,
          inicio: inicioDate ? inicioDate.toISOString().split("T")[0] : null,
          fim: fimDate ? fimDate.toISOString().split("T")[0] : null,
          ativo: ativoCorrigido,
        };
      });

      return promotionsWithLocalTime as Promotion[];
    },
    refetchInterval: 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      nome: string;
      multiplicador: number;
      inicio: string | null;
      fim: string | null;
    }) => {
      const { error } = await supabase.from("promotions").insert({
        ...data,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "✅ Promoção criada!",
        description: `${nome} está ativa agora`,
      });

      setNome("");
      setMultiplicador("2");
      setInicio("");
      setFim("");

      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: showError,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from("promotions")
        .update({ ativo: !currentStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Promoção deletada" });
      queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: showError,
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      return toast({ title: "⚠️ Nome obrigatório", variant: "destructive" });
    }

    if (parseInt(multiplicador) < 1) {
      return toast({ title: "⚠️ Multiplicador inválido", variant: "destructive" });
    }

    createMutation.mutate({
      nome,
      multiplicador: parseInt(multiplicador),
      inicio: inicio || null,
      fim: fim || null,
    });
  };

  const togglePromotion = (id: string, currentStatus: boolean) => {
    toggleMutation.mutate({ id, currentStatus });
  };

  const deletePromotion = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      {/* NOVA PROMOÇÃO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-6 w-6" />
            Nova Promoção
          </CardTitle>
          <CardDescription>Crie promoções de pontos em dobro, triplo, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Promoção</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Black Friday"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="multiplicador">Multiplicador</Label>
                <Input
                  id="multiplicador"
                  type="number"
                  min="1"
                  placeholder="2"
                  value={multiplicador}
                  onChange={(e) => setMultiplicador(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inicio">Data Início (Opcional)</Label>
                <Input id="inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fim">Data Fim (Opcional)</Label>
                <Input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Promoção
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* LISTAGEM DE PROMOÇÕES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-6 w-6" />
            Promoções Cadastradas
            {promotions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {promotions.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              ))
            ) : promotions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma promoção cadastrada</p>
            ) : (
              promotions.map((promo) => (
                <div
                  key={promo.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${promo.ativo ? "bg-green-50" : "bg-gray-50"
                    }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{promo.nome}</h3>
                      <Badge variant="secondary">{promo.multiplicador}x</Badge>
                      {promo.ativo && <Badge variant="default">Ativa</Badge>}
                    </div>
                    {(promo.inicio || promo.fim) && (
                      <p className="text-sm text-muted-foreground">
                        {promo.inicio && `De ${new Date(promo.inicio).toLocaleDateString("pt-BR")}`}
                        {promo.fim && ` até ${new Date(promo.fim).toLocaleDateString("pt-BR")}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {toggleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Switch
                        checked={promo.ativo}
                        onCheckedChange={() => togglePromotion(promo.id, promo.ativo)}
                        disabled={toggleMutation.isPending}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePromotion(promo.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
