import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { endOfDay, format, isSameDay, isWithinInterval, parseISO, startOfDay } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Transaction {
  id: string;
  created_at: string;
  valor: number;
  pontos_gerados: number;
  multiplicador: number;
  tipo: string;
  clients: {
    nome: string;
    codigo: string;
  };
}

export const TransactionHistory = () => {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, clients(nome, codigo)")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as Transaction[];
    },
    refetchInterval: 1000,
  });

  const startToday = startOfDay(new Date());
  const endToday = endOfDay(new Date());
  const today = new Date();

  const saidasDoDia = useMemo(() => {
    return transactions.filter((t) => {
      if (t.tipo !== "retirada") return false;

      const createdAtDate = parseISO(t.created_at);
      const dentroDoDia = isWithinInterval(createdAtDate, {
        start: startToday,
        end: endToday,
      });

      console.log("createdAtDate", createdAtDate, "dentroDoDia?", dentroDoDia);

      return dentroDoDia;
    });
  }, [transactions]);

  const totalSaidas = useMemo(() => {
    return saidasDoDia.reduce((acc, curr) => acc + curr.valor, 0);
  }, [saidasDoDia]);

  const generateDailyPDF = () => {
    const hoje = new Date().toLocaleDateString("pt-BR");
    const retiradas = transactions.filter(t => {
      const transDate = new Date(t.created_at).toLocaleDateString("pt-BR");
      return t.tipo === "retirada" && transDate === hoje;
    });

    const totalRetirado = retiradas.reduce((sum, t) => sum + parseFloat(t.valor.toString()), 0);

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("FERRAGENS NATAL", 105, 15, { align: "center" });
    doc.setFontSize(14);
    doc.text("Relatório de Saídas do Dia", 105, 25, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Data: ${hoje}`, 105, 32, { align: "center" });

    const tableData = retiradas.map(t => [
      new Date(t.created_at).toLocaleTimeString("pt-BR"),
      t.clients.nome,
      t.clients.codigo,
      `R$ ${parseFloat(t.valor.toString()).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Hora", "Cliente", "Código", "Valor"]],
      body: tableData,
      foot: [["", "", "TOTAL:", `R$ ${totalRetirado.toFixed(2)}`]],
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" }
    });

    doc.save(`saidas-${hoje.replace(/\//g, "-")}.pdf`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-6 w-6" />
            Histórico de Transações
          </CardTitle>
          <CardDescription>Últimas 50 transações registradas</CardDescription>
        </div>
        <Button onClick={generateDailyPDF} disabled={isLoading || saidasDoDia.length === 0}>
          Gerar PDF Saídas do Dia
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Pontos</TableHead>
                <TableHead className="text-center">Multiplicador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(transaction.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{transaction.clients.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {transaction.clients.codigo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.tipo === "compra" ? "default" : "secondary"}>
                        {transaction.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {transaction.valor.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-accent">
                      {transaction.pontos_gerados}
                    </TableCell>
                    <TableCell className="text-center">
                      {transaction.multiplicador > 1 && (
                        <Badge variant="destructive">{transaction.multiplicador}x</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};