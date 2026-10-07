-- Nova permissão: ver/gerir TODAS as operações (eventos e pontos fixos) da empresa.
-- Sem ela, o usuário só enxerga as operações em que está vinculado como responsável/coordenador/líder.
-- Arquivo separado: o valor novo de enum só pode ser usado depois que esta transação for confirmada.
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'operacao.todos';
