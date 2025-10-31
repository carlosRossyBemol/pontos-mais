import { useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2, Printer } from "lucide-react";
import { ThermalReceipt } from "./ThermalReceipt";

export const WithdrawBonus = () => {
  const [cpfOrCode, setCpfOrCode] = useState("");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    clientName: string;
    cpfOrCode: string;
    valorRetirado: number;
    saldoRestante: number;
    dataHora: string;
  } | null>(null);
  const { toast } = useToast();

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

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const client = await findClient();

      if (!client) {
        toast({
          title: "❌ Cliente não encontrado",
          description: "Verifique o CPF ou código digitado",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const valorNum = parseFloat(valor);
      const bonusAtual = parseFloat(client.bonus.toString());
      const pontosAtuais = parseFloat(client.pontos?.toString() || "0");

      if (valorNum > bonusAtual) {
        toast({
          title: "❌ Saldo insuficiente",
          description: `Cliente possui apenas R$ ${bonusAtual.toFixed(2)} de bônus`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const novosBonus = bonusAtual - valorNum;

      const pontosARetirar = (valorNum / 10) * 500;
      const novosPontos = Math.max(0, pontosAtuais - pontosARetirar);

      await supabase
        .from("clients")
        .update({ bonus: novosBonus, pontos: novosPontos })
        .eq("id", client.id);

      await supabase.from("transactions").insert({
        client_id: client.id,
        valor: valorNum,
        pontos_gerados: -pontosARetirar,
        multiplicador: 1,
        tipo: "retirada",
      });

      const dataHora = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      setReceiptData({
        clientName: client.nome,
        cpfOrCode: cpfOrCode,
        valorRetirado: valorNum,
        saldoRestante: novosBonus,
        dataHora,
      });

      toast({
        title: "✅ Bônus retirado com sucesso!",
        description: (
          <div className="mt-2 space-y-1">
            <p className="text-lg font-bold">R$ {valorNum.toFixed(2)} retirados</p>
            <p className="text-sm">Saldo restante: R$ {novosBonus.toFixed(2)}</p>
            <p className="text-sm">Pontos restantes: {novosPontos.toFixed(0)}</p>
          </div>
        ),
        duration: 3000,
      });

      setTimeout(() => {
        window.print();
      }, 500);

      setCpfOrCode("");
      setValor("");
    } catch (error: any) {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Retirar Bônus
          </CardTitle>
          <CardDescription>
            Digite o CPF ou código do cliente para retirar bônus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleWithdraw} className="space-y-4">
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
              <Label htmlFor="valor">Valor do Bônus (R$)</Label>
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

            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Retirar Bônus
            </Button>

            {receiptData && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                onClick={handlePrint}
              >
                <Printer className="mr-2 h-5 w-5" />
                Reimprimir Comprovante
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {receiptData &&
        createPortal(
          <ThermalReceipt {...receiptData} />,
          document.body
        )}
    </>
  );
};
