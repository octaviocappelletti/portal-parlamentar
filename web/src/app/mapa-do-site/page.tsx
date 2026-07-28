import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mapa do site',
  description: 'Visão geral de todas as seções e páginas disponíveis no Capivara Parlamentar.',
}

const SECTIONS = [
  {
    label: 'Navegação principal',
    links: [
      { href: '/',            title: 'Página inicial',     desc: 'Estatísticas gerais, busca e visão rápida' },
      { href: '/estados',     title: 'Por estado',          desc: 'Mapa interativo — filtre parlamentares por UF' },
      { href: '/gastos',      title: 'Gastos públicos',     desc: 'Ranking e categorias da cota parlamentar' },
      { href: '/proposicoes', title: 'Proposições',         desc: 'Busca e filtros de projetos de lei' },
    ],
  },
  {
    label: 'Câmara dos Deputados',
    links: [
      { href: '/camara',                       title: 'Lista de deputados',         desc: 'Todos os 513 deputados federais em exercício' },
      { href: '/camara/[id]',                  title: 'Perfil do deputado',         desc: 'Resumo de atuação, mandatos e redes sociais',    dynamic: true },
      { href: '/camara/[id]/proposicoes',      title: 'Proposições do deputado',    desc: 'Projetos de lei e emendas de autoria',          dynamic: true },
      { href: '/camara/[id]/gastos',           title: 'Gastos do deputado',         desc: 'Cota parlamentar mensal detalhada',             dynamic: true },
      { href: '/camara/[id]/presenca',         title: 'Presença do deputado',       desc: 'Participação em sessões e votações',            dynamic: true },
    ],
  },
  {
    label: 'Senado Federal',
    links: [
      { href: '/senado',                       title: 'Lista de senadores',         desc: 'Todos os 81 senadores em exercício' },
      { href: '/senado/[id]',                  title: 'Perfil do senador',          desc: 'Resumo de atuação, mandatos e redes sociais',    dynamic: true },
      { href: '/senado/[id]/proposicoes',      title: 'Proposições do senador',     desc: 'Projetos de lei e emendas de autoria',          dynamic: true },
      { href: '/senado/[id]/gastos',           title: 'Gastos do senador',          desc: 'Cota parlamentar mensal detalhada',             dynamic: true },
      { href: '/senado/[id]/presenca',         title: 'Presença do senador',        desc: 'Participação em sessões e votações',            dynamic: true },
    ],
  },
  {
    label: 'Fornecedores',
    links: [
      { href: '/fornecedor/[cnpj]', title: 'Perfil do fornecedor', desc: 'Histórico de contratos e valores por CNPJ', dynamic: true },
    ],
  },
]

export default function MapaDoSitePage() {
  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-10 sm:py-14">

      <div className="mb-10">
        <p className="section-label mb-2">Navegação</p>
        <h1 className="text-[32px] font-extrabold text-text-strong tracking-tight leading-tight mb-2">
          Mapa do site
        </h1>
        <p className="text-text-body text-[15px] max-w-[560px]">
          Visão completa de todas as seções e páginas disponíveis no portal.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {SECTIONS.map(section => (
          <div key={section.label} className="card p-6">
            <h2 className="section-label mb-4">{section.label}</h2>
            <ul className="space-y-4">
              {section.links.map(link => (
                <li key={link.href}>
                  {link.dynamic ? (
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[14px] font-semibold text-text-strong">
                          {link.title}
                        </span>
                        <span className="text-[10px] bg-surface-alt text-text-muted rounded px-1.5 py-0.5 font-mono leading-none">
                          dinâmica
                        </span>
                      </div>
                      <p className="text-[13px] text-text-body">{link.desc}</p>
                    </div>
                  ) : (
                    <Link href={link.href} className="group block">
                      <span className="text-[14px] font-semibold text-brand-blue group-hover:underline">
                        {link.title}
                      </span>
                      <p className="text-[13px] text-text-body mt-0.5">{link.desc}</p>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border-base bg-surface-alt p-5">
        <p className="text-[13px] text-text-body leading-relaxed">
          <span className="font-semibold text-text-strong">Páginas dinâmicas</span> são geradas individualmente
          para cada parlamentar ou fornecedor. Navegue pela lista de{' '}
          <Link href="/camara" className="text-brand-blue font-semibold hover:underline">deputados</Link>
          {' '}ou{' '}
          <Link href="/senado" className="text-brand-blue font-semibold hover:underline">senadores</Link>
          {' '}— ou use a{' '}
          <Link href="/" className="text-brand-blue font-semibold hover:underline">busca na página inicial</Link>
          {' '}para encontrar um parlamentar específico.
        </p>
      </div>

    </div>
  )
}
