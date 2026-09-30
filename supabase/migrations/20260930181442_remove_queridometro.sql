set lock_timeout = '5s';
set statement_timeout = '30s';

drop function if exists public.get_queridometro_results(date);
drop function if exists public.get_my_queridometro_connections(date);
drop function if exists public.get_queridometro_weeks();

drop table if exists public.queridometro_votes;
drop table if exists public.queridometro_reaction_types;

-- As reações antigas já tinham sido substituídas pelo Queridômetro e não
-- possuíam mais interface. Removê-las conclui a retirada do recurso inteiro.
drop table if exists public.reactions;
drop table if exists public.reaction_types;
