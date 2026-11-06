#!/usr/bin/env node
/**
 * Gera as páginas públicas da vitrine de hotéis.
 *
 * COMO FUNCIONA
 * Lê a visão vitrine_hoteis do Supabase — que só entrega hotéis APROVADOS e só
 * os campos que o hotel concordou em publicar — e escreve HTML pronto no disco.
 *
 * POR QUE HTML PRONTO, E NÃO BUSCA NO NAVEGADOR
 * A vitrine existe para ser achada no Google. Se a página chegasse vazia e
 * preenchesse depois por JavaScript, o robô receberia uma casca sem conteúdo.
 * Gerando o HTML, o Google recebe nome, cidade, descrição e serviços já no
 * primeiro byte.
 *
 * MENU E RODAPÉ
 * São extraídos de parceiros.html em cada geração, em vez de copiados aqui.
 * Assim, mexer no menu do site muda a vitrine junto — sem dois lugares para
 * manter em sintonia.
 *
 * SE NÃO HOUVER NENHUM HOTEL APROVADO
 * Não gera nada. Uma busca que devolve zero resultados vende contra o produto,
 * e página vazia indexada é pior que página inexistente.
 *
 * USO
 *   node tools/gerar-vitrine.mjs            # gera
 *   node tools/gerar-vitrine.mjs --dry-run  # mostra o que faria, sem escrever
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://meupethoje.com.br';
const WHATS_PRODUTO = '13129897348'; // contato do Meu Pet Hoje, não do hotel

// A chave publicável é pública por natureza — vai no bundle do app.  A proteção
// não está em esconder a chave, está na visão: ela só expõe hotéis aprovados e
// só os campos consentidos.
const SUPABASE_URL = process.env.SUPABASE_URL
  ?? 'https://dvgntkyhrjfrvnbkghhf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
  ?? 'sb_publishable_aOO9KJl7KL2e0feXlFjlHA_RK8S-YOx';

const DRY = process.argv.includes('--dry-run');

// Modo amostra: inventa hotéis para conferir o desenho das páginas sem tocar
// no banco e sem publicar nada.  Escreve numa pasta separada.
const AMOSTRA = process.argv.includes('--amostra');
const SAIDA_ALT = (process.argv.find((a) => a.startsWith('--saida=')) ?? '').slice(8);

const HOTEIS_AMOSTRA = [
  {
    id: '1', slug: 'hotel-patas-felizes', cidade_slug: 'campinas',
    nome: 'Hotel Patas Felizes', logo: null,
    cidade: 'Campinas', estado: 'SP',
    descricao: 'Hospedagem com área externa gramada, acompanhamento 24 horas e fotos do seu pet todos os dias. Somos um time pequeno e cuidamos de poucos pets por vez, justamente para conhecer cada um pelo nome.',
    servicos: ['Hospedagem', 'Creche (daycare)', 'Banho e tosa', 'Monitoramento 24h', 'Aceita gatos'],
    fotos: [], whatsapp: '5519999998888', publicado_em: '2026-11-01T12:00:00Z',
  },
  {
    id: '2', slug: 'casa-do-bidu', cidade_slug: 'campinas',
    nome: 'Casa do Bidu', logo: null,
    cidade: 'Campinas', estado: 'SP',
    descricao: 'Creche e hospedagem em casa adaptada, sem canis. Os pets ficam soltos em ambiente climatizado e saem para passear duas vezes por dia.',
    servicos: ['Hospedagem', 'Passeios', 'Leva e traz'],
    fotos: [], whatsapp: '5519977776666', publicado_em: '2026-11-01T12:00:00Z',
  },
  {
    id: '3', slug: 'pousada-au-au', cidade_slug: 'sao-paulo',
    nome: 'Pousada Au Au', logo: null,
    cidade: 'São Paulo', estado: 'SP',
    descricao: 'Hospedagem com acompanhamento veterinário na casa e piscina para os dias quentes.',
    servicos: ['Hospedagem', 'Acompanhamento veterinário', 'Aceita porte grande'],
    fotos: [], whatsapp: '5511955554444', publicado_em: '2026-11-01T12:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Texto para atributo de meta: uma linha, sem quebras, cortado com elegância. */
function resumo(txt, max = 155) {
  const t = String(txt ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const ultimoEspaco = corte.lastIndexOf(' ');
  return (ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : corte).replace(/[.,;:]$/, '') + '…';
}

/** Só dígitos — o link do WhatsApp não aceita nada além. */
const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

function escreve(caminho, conteudo) {
  const destino = join(SAIDA_ALT || RAIZ, caminho);
  if (DRY) { console.log(`  [seco] escreveria ${caminho} (${conteudo.length} bytes)`); return; }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, conteudo, 'utf8');
  console.log(`  escrito ${caminho}`);
}

// ---------------------------------------------------------------------------
// menu e rodapé, extraídos de uma página existente
// ---------------------------------------------------------------------------

function pegarChrome() {
  const fonte = readFileSync(join(RAIZ, 'parceiros.html'), 'utf8');

  const iniTopo = fonte.indexOf('<svg width="0"');
  const fimTopo = fonte.indexOf('</nav>', fonte.indexOf('<nav class="drawer"'));
  const iniBase = fonte.indexOf('<footer class="ft">');
  const fimBase = fonte.indexOf('</body>');

  if (iniTopo < 0 || fimTopo < 0 || iniBase < 0 || fimBase < 0) {
    throw new Error(
      'Não achei o menu ou o rodapé em parceiros.html. A estrutura do site mudou — ' +
      'ajuste pegarChrome() antes de gerar, para as páginas não saírem sem navegação.',
    );
  }
  // Ícones, fontes e folhas de estilo também vêm da página existente.  Fixar
  // "site.css?v=2" aqui já estava errado: o site publicado está em v=4.  O
  // número sobe a cada mudança de estilo, e uma cópia fixa envelhece calada.
  const iniAtivos = fonte.indexOf('<link rel="icon"');
  const linhaCss = fonte.indexOf('\n', fonte.indexOf('/assets/css/site.css'));
  if (iniAtivos < 0 || linhaCss < 0) {
    throw new Error('Não achei os links de ícone/estilo em parceiros.html.');
  }

  return {
    topo: fonte.slice(iniTopo, fimTopo + '</nav>'.length),
    base: fonte.slice(iniBase, fimBase),
    ativos: fonte.slice(iniAtivos, linhaCss).trim(),
  };
}

// ---------------------------------------------------------------------------
// moldura de uma página
// ---------------------------------------------------------------------------

function pagina({ titulo, descricao, url, corpo, jsonLd, chrome, imagem }) {
  const og = imagem || `${SITE}/assets/img/og-image.jpg`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}" />
<link rel="canonical" href="${esc(url)}" />
<meta name="robots" content="index, follow" />
<meta name="theme-color" content="#FF6040" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:site_name" content="Meu Pet Hoje" />
<meta property="og:title" content="${esc(titulo)}" />
<meta property="og:description" content="${esc(descricao)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(og)}" />
<meta name="twitter:card" content="summary_large_image" />
${chrome.ativos}
<link rel="stylesheet" href="/assets/css/vitrine.css?v=1" />
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
${chrome.topo}
<main id="conteudo">
${corpo}
</main>
${chrome.base}
</body>
</html>
`;
}

const migalhas = (itens) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: itens.map((it, i) => ({
    '@type': 'ListItem', position: i + 1, name: it.nome, item: it.url,
  })),
});

// ---------------------------------------------------------------------------
// páginas
// ---------------------------------------------------------------------------

function paginaHotel(h, chrome) {
  const url = `${SITE}/hoteis/${h.cidade_slug}/${h.slug}`;
  const local = `${h.cidade}${h.estado ? `, ${h.estado}` : ''}`;
  const zap = soDigitos(h.whatsapp);
  const servicos = Array.isArray(h.servicos) ? h.servicos.filter(Boolean) : [];
  const fotos = Array.isArray(h.fotos) ? h.fotos.filter(Boolean) : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': url,
        name: h.nome,
        description: resumo(h.descricao, 400),
        url,
        // Endereço completo NÃO é publicado — o hotel não consentiu com isso.
        // Cidade e estado bastam para a busca local entender onde ele atua.
        address: {
          '@type': 'PostalAddress',
          addressLocality: h.cidade,
          addressRegion: h.estado,
          addressCountry: 'BR',
        },
        ...(h.logo ? { logo: h.logo, image: h.logo } : {}),
        ...(fotos.length ? { photo: fotos } : {}),
        ...(servicos.length ? { makesOffer: servicos.map((s) => ({
          '@type': 'Offer', itemOffered: { '@type': 'Service', name: s },
        })) } : {}),
      },
      migalhas([
        { nome: 'Hotéis para pets', url: `${SITE}/hoteis/` },
        { nome: h.cidade, url: `${SITE}/hoteis/${h.cidade_slug}/` },
        { nome: h.nome, url },
      ]),
    ],
  };

  const corpo = `
<section class="vt-hero">
  <div class="wrap">
    <nav class="vt-migalhas" aria-label="Você está em">
      <a href="/hoteis/">Hotéis para pets</a> <span aria-hidden="true">›</span>
      <a href="/hoteis/${esc(h.cidade_slug)}/">${esc(h.cidade)}</a> <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(h.nome)}</span>
    </nav>
    <div class="vt-cabeca">
      ${h.logo ? `<img class="vt-logo" src="${esc(h.logo)}" width="88" height="88" alt="" loading="eager" />` : ''}
      <div>
        <h1>${esc(h.nome)}</h1>
        <p class="vt-local">${esc(local)}</p>
      </div>
    </div>
    ${h.descricao ? `<p class="vt-desc vt-desc-hotel">${esc(h.descricao)}</p>` : ''}
    ${zap ? `<a class="btn btn-wa btn-lg" href="https://wa.me/${esc(zap)}?text=${encodeURIComponent(`Olá! Encontrei o ${h.nome} no Meu Pet Hoje e gostaria de saber sobre hospedagem para meu pet.`)}"><svg><use href="#i-wa"/></svg> Falar com o ${esc(h.nome)}</a>` : ''}
  </div>
</section>

${servicos.length ? `<section class="vt-bloco">
  <div class="wrap">
    <h2>O que este hotel oferece</h2>
    <ul class="vt-servicos">
      ${servicos.map((s) => `<li>${esc(s)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>` : ''}

${fotos.length ? `<section class="vt-bloco">
  <div class="wrap">
    <h2>Fotos</h2>
    <div class="vt-fotos">
      ${fotos.map((f, i) => `<img src="${esc(f)}" alt="Foto do ${esc(h.nome)}" loading="${i < 2 ? 'eager' : 'lazy'}" />`).join('\n      ')}
    </div>
  </div>
</section>` : ''}

<section class="vt-bloco vt-acompanhe">
  <div class="wrap">
    <h2>Acompanhe o dia do seu pet</h2>
    <p>
      O ${esc(h.nome)} usa o Meu Pet Hoje. A equipe registra refeições, passeios
      e fotos ao longo do dia, e você recebe tudo no celular — sem precisar
      ligar para perguntar como ele está.
    </p>
    <a class="btn btn-primary" href="/">Ver como funciona</a>
  </div>
</section>
`;

  return {
    caminho: `hoteis/${h.cidade_slug}/${h.slug}.html`,
    url,
    html: pagina({
      titulo: `${h.nome} — hotel para pets em ${local} | Meu Pet Hoje`,
      descricao: h.descricao
        ? resumo(h.descricao)
        : `${h.nome} é um hotel para pets em ${local}. Fale no WhatsApp e acompanhe o dia do seu pet pelo app Meu Pet Hoje.`,
      url, corpo, jsonLd, chrome,
      imagem: fotos[0] || h.logo || undefined,
    }),
  };
}

function cartao(h) {
  const servicos = (Array.isArray(h.servicos) ? h.servicos : []).slice(0, 3);
  return `      <a class="vt-card" href="/hoteis/${esc(h.cidade_slug)}/${esc(h.slug)}">
        ${h.logo ? `<img src="${esc(h.logo)}" width="64" height="64" alt="" loading="lazy" />` : '<span class="vt-card-sem" aria-hidden="true">🏨</span>'}
        <span class="vt-card-txt">
          <strong>${esc(h.nome)}</strong>
          <span class="vt-card-local">${esc(h.cidade)}${h.estado ? `, ${esc(h.estado)}` : ''}</span>
          ${h.descricao ? `<span class="vt-card-desc">${esc(resumo(h.descricao, 110))}</span>` : ''}
          ${servicos.length ? `<span class="vt-card-tags">${servicos.map((s) => `<span>${esc(s)}</span>`).join('')}</span>` : ''}
        </span>
      </a>`;
}

function paginaCidade(cidadeSlug, hoteis, chrome) {
  const { cidade, estado } = hoteis[0];
  const local = `${cidade}${estado ? `, ${estado}` : ''}`;
  const url = `${SITE}/hoteis/${cidadeSlug}/`;
  const n = hoteis.length;

  const corpo = `
<section class="vt-hero">
  <div class="wrap">
    <nav class="vt-migalhas" aria-label="Você está em">
      <a href="/hoteis/">Hotéis para pets</a> <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(cidade)}</span>
    </nav>
    <h1>Hotéis para pets em ${esc(cidade)}</h1>
    <p class="vt-desc">${n === 1 ? 'Um hotel' : `${n} hotéis`} em ${esc(local)} que ${n === 1 ? 'usa' : 'usam'} o Meu Pet Hoje: você acompanha refeições, passeios e fotos do seu pet pelo celular durante a hospedagem.</p>
  </div>
</section>

<section class="vt-bloco">
  <div class="wrap">
    <div class="vt-lista">
${hoteis.map(cartao).join('\n')}
    </div>
  </div>
</section>
`;

  return {
    caminho: `hoteis/${cidadeSlug}/index.html`,
    url,
    html: pagina({
      titulo: `Hotéis para pets em ${local} — Meu Pet Hoje`,
      descricao: `${n === 1 ? 'Hotel' : `${n} hotéis`} para pets em ${local} com acompanhamento pelo celular: fotos, refeições e passeios do seu pet durante a hospedagem.`,
      url, corpo, chrome,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'ItemList',
            name: `Hotéis para pets em ${local}`,
            numberOfItems: n,
            itemListElement: hoteis.map((h, i) => ({
              '@type': 'ListItem', position: i + 1, name: h.nome,
              url: `${SITE}/hoteis/${h.cidade_slug}/${h.slug}`,
            })),
          },
          migalhas([
            { nome: 'Hotéis para pets', url: `${SITE}/hoteis/` },
            { nome: cidade, url },
          ]),
        ],
      },
    }),
  };
}

function paginaIndice(porCidade, chrome) {
  const url = `${SITE}/hoteis/`;
  const cidades = [...porCidade.entries()]
    .sort((a, b) => a[1][0].cidade.localeCompare(b[1][0].cidade, 'pt-BR'));
  const total = [...porCidade.values()].reduce((s, l) => s + l.length, 0);

  const corpo = `
<section class="vt-hero">
  <div class="wrap">
    <h1>Hotéis para pets</h1>
    <p class="vt-desc">${total === 1 ? 'Um hotel' : `${total} hotéis`} em ${cidades.length === 1 ? 'uma cidade' : `${cidades.length} cidades`} que ${total === 1 ? 'usa' : 'usam'} o Meu Pet Hoje. Durante a hospedagem você acompanha refeições, passeios e fotos do seu pet pelo celular.</p>
  </div>
</section>

<section class="vt-bloco">
  <div class="wrap">
    <h2>Escolha a cidade</h2>
    <div class="vt-cidades">
      ${cidades.map(([slug, l]) => `<a class="vt-cidade" href="/hoteis/${esc(slug)}/">
        <strong>${esc(l[0].cidade)}</strong>
        <span>${esc(l[0].estado ?? '')}</span>
        <em>${l.length} ${l.length === 1 ? 'hotel' : 'hotéis'}</em>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="vt-bloco vt-convite">
  <div class="wrap">
    <h2>Tem um hotel pet e quer aparecer aqui?</h2>
    <p>
      Hotéis que usam o Meu Pet Hoje podem pedir sua vaga na vitrine pelo
      próprio app, em Configurações. A publicação passa pela nossa conferência.
    </p>
    <a class="btn btn-wa" href="https://wa.me/${WHATS_PRODUTO}?text=${encodeURIComponent('Olá! Tenho um hotel pet e quero aparecer na vitrine do Meu Pet Hoje.')}"><svg><use href="#i-wa"/></svg> Falar com a gente</a>
  </div>
</section>
`;

  return {
    caminho: 'hoteis/index.html',
    url,
    html: pagina({
      titulo: 'Hotéis para pets no Brasil — Meu Pet Hoje',
      descricao: `Encontre hotéis para pets que mostram o dia do seu pet pelo celular: fotos, refeições e passeios em tempo real. ${total} ${total === 1 ? 'hotel' : 'hotéis'} em ${cidades.length} ${cidades.length === 1 ? 'cidade' : 'cidades'}.`,
      url, corpo, chrome,
      jsonLd: migalhas([{ nome: 'Hotéis para pets', url }]),
    }),
  };
}

// ---------------------------------------------------------------------------
// sitemap — preserva o que já existe e acrescenta a vitrine
// ---------------------------------------------------------------------------

function atualizarSitemap(urls) {
  const caminho = join(RAIZ, 'sitemap.xml');
  const hoje = new Date().toISOString().slice(0, 10);
  const antigo = existsSync(caminho) ? readFileSync(caminho, 'utf8') : '';

  // Mantém as páginas fixas do site, descarta entradas antigas da vitrine
  // (um hotel suspenso precisa sair do sitemap).
  const fixas = [...antigo.matchAll(/<url>[\s\S]*?<\/url>/g)]
    .map((m) => m[0])
    .filter((b) => !b.includes('/hoteis/'));

  const novas = urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${hoje}</lastmod>
  </url>`);

  escreve('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">
${[...fixas.map((f) => f.split('\n').map((l) => l.trim() ? '  ' + l.trim() : l).join('\n')), ...novas].join('\n')}
</urlset>
`);
}

// ---------------------------------------------------------------------------
// principal
// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY ? 'Modo seco — nada será escrito.\n' : '');
  console.log('Buscando hotéis aprovados...');

  if (AMOSTRA) {
    console.log('MODO AMOSTRA — hotéis inventados, banco não consultado.');
    return gerar(HOTEIS_AMOSTRA);
  }

  const resposta = await fetch(
    `${SUPABASE_URL}/rest/v1/vitrine_hoteis?select=*&order=nome.asc`,
    { headers: { apikey: SUPABASE_KEY, Accept: 'application/json' } },
  );
  if (!resposta.ok) {
    throw new Error(`Supabase respondeu ${resposta.status}: ${await resposta.text()}`);
  }
  const hoteis = await resposta.json();
  console.log(`${hoteis.length} hotel(is) aprovado(s).`);
  return gerar(hoteis);
}

function gerar(hoteis) {
  if (hoteis.length === 0) {
    console.log(
      '\nNenhum hotel aprovado — nada foi gerado, de propósito.\n' +
      'Uma busca vazia vende contra o produto, e página vazia indexada é pior\n' +
      'que página inexistente. Aprove um hotel (select aprovar_vitrine(...)) e\n' +
      'rode de novo.',
    );
    return;
  }

  const chrome = pegarChrome();

  const porCidade = new Map();
  for (const h of hoteis) {
    if (!h.slug || !h.cidade_slug) {
      console.warn(`  ignorado: "${h.nome}" está sem endereço de página.`);
      continue;
    }
    if (!porCidade.has(h.cidade_slug)) porCidade.set(h.cidade_slug, []);
    porCidade.get(h.cidade_slug).push(h);
  }

  const urls = [];
  console.log('\nGerando páginas:');

  const indice = paginaIndice(porCidade, chrome);
  escreve(indice.caminho, indice.html);
  urls.push(indice.url);

  for (const [slug, lista] of porCidade) {
    const pc = paginaCidade(slug, lista, chrome);
    escreve(pc.caminho, pc.html);
    urls.push(pc.url);
    for (const h of lista) {
      const ph = paginaHotel(h, chrome);
      escreve(ph.caminho, ph.html);
      urls.push(ph.url);
    }
  }

  console.log('\nAtualizando sitemap:');
  atualizarSitemap(urls);

  console.log(`\nPronto. ${urls.length} endereço(s) na vitrine.`);
}

main().catch((e) => {
  console.error('\nFALHOU:', e.message);
  process.exit(1);
});
