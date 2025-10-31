import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Promotion {
  id: string;
  nome: string;
  multiplicador: number;
}

export const RegisterPurchase = () => {
  const [cpfOrCode, setCpfOrCode] = useState("");
  const [valor, setValor] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: promotions = [], isLoading: promotionsLoading } = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("promotions")
        .select("*")
        .eq("ativo", true);

      if (!data) return [];

      const now = new Date();
      const validPromotions = data.filter((p) => {
        if (!p.inicio && !p.fim) return true;
        
        if (p.inicio && p.fim) {
          const start = new Date(p.inicio);
          const end = new Date(p.fim);
          return start <= now && end >= now;
        }
        
        if (p.inicio) {
          return new Date(p.inicio) <= now;
        }
        
        if (p.fim) {
          return new Date(p.fim) >= now;
        }
        
        return true;
      });
      
      return validPromotions as Promotion[];
    },
  });

  const findClient = async () => {
    const cleanInput = cpfOrCode.replace(/\D/g, "");
    
    let query = supabase.from("clients").select("*");
    
    if (cleanInput.length === 4) {
      query = query.eq("codigo", cleanInput);
    } else {
      query = query.eq("cpf", cleanInput);
    }

    const { data } = await query.single();
    return data;
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      const client = await findClient();

      if (!client) {
        setShowNewClientDialog(true);
        throw new Error("Cliente não encontrado");
      }

      return processPurchase(client.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: any) => {
      if (error.message !== "Cliente não encontrado") {
        toast({
          title: "❌ Erro",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate();
  };

  const newClientMutation = useMutation({
    mutationFn: async () => {
      const cleanCpf = cpfOrCode.replace(/\D/g, "");
      const { data: newCode } = await supabase.rpc("generate_unique_code");

      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          nome,
          cpf: cleanCpf,
          telefone,
          codigo: newCode,
        })
        .select()
        .single();

      if (error) throw error;

      return { client, newCode };
    },
    onSuccess: async ({ client, newCode }) => {
      toast({
        title: "✅ Cliente cadastrado com sucesso!",
        description: (
          <div className="mt-2">
            <p className="text-lg font-bold">Código: {newCode}</p>
            <p className="text-sm">Cliente pode usar este código nas próximas compras</p>
          </div>
        ),
        duration: 3000,
      });

      setShowNewClientDialog(false);
      await processPurchase(client.id);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNewClient = async () => {
    newClientMutation.mutate();
  };

  const processPurchase = async (clientId: string) => {
    const valorNum = parseFloat(valor);
    
    let multiplicador = 1;
    let promotionName = "Nenhuma";
    
    if (selectedPromotion && selectedPromotion !== "none") {
      const promotion = promotions.find((p) => p.id === selectedPromotion);
      if (promotion) {
        multiplicador = promotion.multiplicador;
        promotionName = promotion.nome;
      }
    }
    
    const pontosGerados = Math.floor(valorNum * multiplicador);
    
    console.log('🛒 Processando compra:', {
      valor: valorNum,
      promocaoSelecionada: selectedPromotion,
      promocaoEncontrada: promotionName,
      multiplicador,
      pontosGerados,
      calculo: `${valorNum} * ${multiplicador} = ${pontosGerados}`
    });

    // Buscar cliente atual
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (!client) return;

    const novosPontos = client.pontos + pontosGerados;
    const novosBonus = Math.floor(novosPontos / 500) * 10;
    const bonusGerado = novosBonus - parseFloat(client.bonus.toString());

    // Atualizar cliente
    await supabase
      .from("clients")
      .update({
        pontos: novosPontos,
        bonus: novosBonus,
      })
      .eq("id", clientId);

    // Registrar transação
    await supabase.from("transactions").insert({
      client_id: clientId,
      valor: valorNum,
      pontos_gerados: pontosGerados,
      multiplicador,
      tipo: "compra",
    });

    toast({
      title: "✅ Compra registrada com sucesso!",
      description: (
        <div className="mt-2 space-y-1">
          <p className="text-lg font-bold">{pontosGerados} pontos gerados</p>
          {multiplicador > 1 && (
            <p className="text-sm">🎉 Promoção {multiplicador}x aplicada!</p>
          )}
          <p className="text-sm">Total de pontos: {novosPontos}</p>
          {bonusGerado > 0 && (
            <p className="text-sm font-bold text-success">💰 Bônus de R$ {bonusGerado.toFixed(2)} concedido!</p>
          )}
          <p className="text-sm font-mono">
          Código do cliente: <strong>{client.codigo}</strong>
        </p>
        </div>
      ),
      duration: 5000,
    });

    setCpfOrCode("");
    setValor("");
    setSelectedPromotion("");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Registrar Compra
          </CardTitle>
          <CardDescription>
            Digite o CPF ou código do cliente para registrar uma compra
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpfOrCode">CPF ou Código</Label>
              <Input
                id="cpfOrCode"
                placeholder="Digite CPF ou código de 4 dígitos"
                value={cpfOrCode}
                onChange={(e) => setCpfOrCode(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor da Compra (R$)</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
            </div>

            {promotionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : promotions.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="promotion">Promoção</Label>
                <Select value={selectedPromotion} onValueChange={setSelectedPromotion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem promoção (1x)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem promoção (1x)</SelectItem>
                    {promotions.map((promo) => (
                      <SelectItem key={promo.id} value={promo.id}>
                        {promo.nome} ({promo.multiplicador}x)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button 
              type="submit" 
              className="w-full h-12" 
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Registrar Compra
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>
              Cliente não encontrado. Preencha os dados para cadastrar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
              />
            </div>
            <Button 
              onClick={handleNewClient} 
              className="w-full" 
              disabled={newClientMutation.isPending}
            >
              {newClientMutation.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Cadastrar e Registrar Compra
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};