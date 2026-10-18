# Jogatina — SPA

Versão web (Angular 22) do app Android `E:\Projetos\Mobile\jogatina`, consumindo a
API `E:\Projetos\Jogatina\CleanArchitecture.slnx`.

Mantém a identidade visual navy + magenta neon, o fluxo de navegação e todas as
funcionalidades do app nativo:

- **Welcome + autenticação** por e-mail (login e cadastro; o cadastro já entra).
- **Feed** com composer de texto/imagem, reactions (❤️ 🎉 😮 😂 💡), comentários,
  respostas, upload de imagem e exclusão dos próprios posts.
- **Biblioteca + catálogo** de jogos: status (Quero jogar/Jogando/Zerado),
  favorito, capa, busca/filtros, "carregar mais", convite para jogar com amigos.
- **Notificações** com filtro Todas/Não lidas, marcar como lida, ler todas, badge
  e atualizações em tempo real + polling de 60 s.
- **Chat** em tempo real via WebSocket (`/ws/chat`), histórico, conversas com
  badge, nova conversa, imagens, reconexão e renovação de sessão.
- **Perfil** (foto, nascimento, hobbies, país) + **amigos** (pedidos, busca,
  online/offline, conversar, remover) + **perfil público** do autor.
- **i18n** inglês/português (padrão pelo idioma do navegador, alternável no topo).
- Layout responsivo: navegação inferior no mobile e topo no desktop.

## Como rodar

Pré-requisitos: Node.js 20+ (testado com Node 24) e npm.

```powershell
npm install
npm start
```

Abra `http://localhost:4200`.

### Environments / API usada

| Ambiente             | Arquivo                                      | `apiBaseUrl`            | Comando               |
| -------------------- | -------------------------------------------- | ----------------------- | --------------------- |
| Dev/preview (padrão) | `src/environments/environment.ts`            | `''` + proxy            | `npm start`           |
| Local                | `src/environments/environment.local.ts`      | `http://localhost:5000` | `npm run start:local` |
| Produção             | `src/environments/environment.production.ts` | `https://agfapp.com`    | `npm run build`       |

O modo padrão (`npm start`) usa o **proxy** de `proxy.conf.json` para
`https://agfapp.com` — não precisa da API rodando e não há CORS no navegador; as
imagens `/uploads`, `/game-covers` e `/chat-images` também passam pelo proxy.

Para rodar contra a **API local** (`http://localhost:5000`, perfil `http` do
`launchSettings.json`):

```powershell
dotnet run --project E:\Projetos\Jogatina\src\Web.Api
npm run start:local
```

O modo local chama a API direto (sem proxy), então a origem
`http://localhost:4200` precisa estar liberada no CORS da API — já está na
configuração padrão.

### Produção

```powershell
npm run build
```

O build de produção usa `src/environments/environment.production.ts`
(`apiBaseUrl: 'https://agfapp.com'`) e gera `dist/jogatina-spa/browser`.
Sirva essa pasta em qualquer host estático (o roteamento precisa de fallback para
`index.html`).

### Preview em redes sociais

As metatags **Open Graph / Twitter** ficam em `src/index.html` e usam a imagem
`public/assets/jogatina-social.jpg` (1200×630). Se o domínio do SPA mudar,
atualize `canonical`, `og:url`, `og:image` e `twitter:image` para o novo endereço.
O WhatsApp costuma cachear o preview: para forçar uma nova leitura, compartilhe a
URL com um parâmetro novo (ex.: `?v=2`) ou aguarde o cache expirar.

## CORS na API

Para o SPA conseguir chamar a API diretamente de outra origem, o
`src/Web.Api/Program.cs` foi atualizado com CORS configurável em
`appsettings.json`:

```json
"Cors": {
  "AllowedOrigins": [
    "http://localhost:4200",
    "https://localhost:4200",
    "https://agfapp.com",
    "https://www.agfapp.com"
  ]
}
```

Inclua o domínio onde o SPA será publicado nessa lista.

## Estrutura

```
src/app/
├── core/
│   ├── api.service.ts          # JWT Bearer, refresh automático em 401, multipart
│   ├── auth/                   # AuthService, TokenStore, guards
│   ├── i18n/                   # traduções EN/PT e nomes de países
│   ├── realtime/               # WebSocket do chat (ping/reconexão/refresh)
│   └── utils.ts                # problem+json, tokens de imagem, device info
├── data/                       # modelos + serviços REST (feed, games, users, ...)
├── layout/                     # shell autenticado (topbar + bottom nav)
├── shared/                     # avatar, ícones SVG, modal, page header
└── features/
    ├── welcome/                # mockup animado + login/cadastro
    ├── feed/                   # posts, reactions, comentários
    ├── games/                  # biblioteca, catálogo e diálogo de status/capa
    ├── notifications/
    ├── chat/                   # lista, conversa e nova conversa
    ├── profile/                # perfil, edição e perfil público
    └── social/                 # amigos, pedidos e busca
```

Os assets `public/assets/fighter_*.png` e `jogatina.png` vieram do app Android
(`app/src/main/res/drawable`).

## Comportamentos espelhados da API

- `POST auth/login`, `POST auth/register`, `POST auth/refresh-token` (rotativo).
- `users/me`, `users/{id}/profile`, `users/{id}/games`, `users/me/photo`.
- `feed/posts`, `feed/images`, `feed/posts/{id}/likes`, `feed/posts/{id}/comments`.
- `games`, `users/me/games`, `games/{id}/invites`, `games/{id}/cover`.
- `notifications`, `notifications/{id}/read`, `notifications/read-all`.
- `chat/conversations`, `chat/conversations/{id}/messages`, `chat/images` e
  `WS /ws/chat?access_token=...`.
- `users/me/friends`, `users/search`, `social/friend-requests`,
  `social/friends/{id}`.

A troca de status/favorito de um jogo usa DELETE + POST, como no Android, porque
a API não expõe update. O 409 (`AlreadyInLibrary`) no catálogo oferece atualizar.

## Observações

- O login social (Google/Discord) ainda não está plugado nesta versão web — o
  fluxo de e-mail/senha é o mesmo do dialog do Android.
- O app Android envia notificações do sistema; na web o navegador recebe
  `Notification` quando a aba está em segundo plano e a permissão é concedida
  (pedida ao abrir a tela de notificações).
- A API "dorme" sem tráfego; o cliente HTTP repete uma vez falhas de rede e
  renova o token automaticamente em 401.
