-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text UNIQUE NOT NULL,
  telefone text NOT NULL,
  codigo text UNIQUE NOT NULL,
  pontos integer NOT NULL DEFAULT 0,
  bonus numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Criar tabela de transações
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  valor numeric(10,2) NOT NULL,
  pontos_gerados integer NOT NULL,
  multiplicador integer NOT NULL DEFAULT 1,
  tipo text NOT NULL DEFAULT 'compra', -- 'compra' ou 'resgate'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Criar tabela de promoções
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  multiplicador integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  inicio timestamptz,
  fim timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para clientes (permitir operações autenticadas)
CREATE POLICY "Usuários autenticados podem visualizar clientes"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar clientes"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar clientes"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (true);

-- Políticas RLS para transações
CREATE POLICY "Usuários autenticados podem visualizar transações"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar transações"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas RLS para promoções
CREATE POLICY "Usuários autenticados podem visualizar promoções"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar promoções"
  ON public.promotions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar promoções"
  ON public.promotions FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem deletar promoções"
  ON public.promotions FOR DELETE
  TO authenticated
  USING (true);

-- Função para gerar código único de 4 dígitos
CREATE OR REPLACE FUNCTION public.generate_unique_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.clients WHERE codigo = new_code) INTO code_exists;
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_codigo ON public.clients(codigo);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON public.transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_ativo ON public.promotions(ativo);

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;