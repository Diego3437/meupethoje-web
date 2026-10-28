# Site do Meu Pet Hoje — meupethoje.com.br

Site estático (HTML + CSS + JS, sem build obrigatório). Publicado no GitHub Pages com o domínio da Hostinger.

## Onde mudar cada coisa
| O quê | Arquivo |
|---|---|
| Número do WhatsApp, e-mail, link da App Store, mensagens prontas | `assets/js/site.js` (objeto `MPH` no topo) |
| Cores, fontes, botões, menu, rodapé (todas as páginas) | `assets/css/site.css` |
| Visual da página inicial | `assets/css/home.css` |
| Textos da página inicial | `index.html` |
| Programa Parceiros Fundadores + formulário | `parceiros.html` |
| Política de Privacidade | `privacidade.html` (cópia em `privacy-policy.html` para o link antigo da App Store) |

## Estrutura pronta para crescer
- **Planos e preços:** seção `#planos` em `index.html`. Quando os valores estiverem definidos, troque "Condição especial" / "Em breve" pelos preços. Se quiser uma página própria, copie `parceiros.html` como `planos.html`.
- **Assinatura e pagamento online:** o caminho mais simples é um link de pagamento recorrente (Mercado Pago, Stripe ou Asaas) colocado no botão de cada plano. Não precisa de servidor.
- **Hotéis parceiros:** quando houver parceiros com autorização, dá para adicionar uma faixa "Hotéis que já usam" na página inicial.
- **Follow-ups e campanhas:** a seção de relacionamento já mostra "em implantação" e "em breve". Atualize os rótulos quando os recursos forem lançados.
- **Captação de leads:** o formulário de `parceiros.html` abre o WhatsApp com os dados preenchidos (sem servidor). Se um dia quiser guardar os leads numa planilha, dá para trocar por Formspree ou Google Forms.

## Páginas com cabeçalho e rodapé repetidos
Cada `.html` tem o mesmo cabeçalho e rodapé. Ao mudar o menu, mude em todas as páginas.
